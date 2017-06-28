import * as Path from 'path';
import * as fs from 'fs';
import * as EventEmitter from 'events';

export interface ClassConstructor extends Function {
    new (...args: any[]): any;
}

export interface FileInfo {
    absolutePath: string;
    dirname: string;
    basename: string;
}

export interface ModuleInfo {
    module: any;
    file: FileInfo;
}

export interface InstanceInfo {
    Class: ClassConstructor;
    instance: any;
    file: FileInfo;
}

export interface RecursiveFilterFilesOptions {
    basePath: string;
    maxDepth: number;
}

export enum FileType {
    Other,
    File,
    Directory
}

export interface LoaderOptions {
    [key: string]: any;

    cwd?: string;
    depth?: number;
    ext?: string;

    fileFilter?: RegExp;
    dirFilter?: RegExp;

    load?: (path: string, depth?: number) => any[];
    getFiles?: (path: string, depth?: number) => FileInfo[];
    loadFile?: (file: FileInfo) => any;

    transform?: (data: any[]) => any;

    recursiveFilterFiles?: (path: string, files: FileInfo[], opts: RecursiveFilterFilesOptions) => void;
    checkFileType?: (path: string) => FileType;
    filterFile?: (absolutePath: string, dirname: string, basename: string) => boolean;
    FilterDir?: (absolutePath: string, basePath: string) => boolean;

    require?: (file: FileInfo) => any;
    processModule?: (moduleInfo: ModuleInfo) => any;
}

export class FileLoader extends EventEmitter {
    cwd = '';
    /**
     * depth start from 0, -1 equal Number.POSITIVE_INFINITY
     */
    depth: number;
    ext = '.js';
    fileFilter = /.*\.js$/i;
    dirFilter = /./i;

    constructor(opts?: LoaderOptions) {
        super();

        this.override([
            'cwd',
            'depth',
            'ext',
            'fileFilter',
            'dirFilter',
            'load',
            'getFiles',
            'loadFile',
            'transform',
            'recursiveFilterFiles',
            'checkFileTpe',
            'filterFile',
            'filterDir',
            'require',
            'processModule'
        ], opts);
    }

    protected override(names: string[], opts?: { [key: string]: any; }): void {
        if (!opts) {
            return;
        }

        names.forEach(name => {
            if (Object.prototype.hasOwnProperty.call(opts, name)) {
                if (!opts[name] && typeof (<any>this)[name] === 'function') {
                    return;
                }
                (<any>this)[name] = opts[name];
            }
        });
    }

    load(path: string, depth?: number): any {
        let files = this.getFiles(path, depth);
        return this.transform(files.map(file => this.loadFile(file)));
    }

    /**
     *
     * @param path
     * @param depth start from 0, -1 equal Number.POSITIVE_INFINITY
     */
    getFiles(path: string, depth?: number): FileInfo[] {
        if (Path.isAbsolute(path)) {
            path = Path.normalize(path);
        } else {
            path = Path.resolve(this.cwd, path);
        }

        let opts: RecursiveFilterFilesOptions = {
            basePath: path,
            maxDepth: this.depth
        };
        if (typeof depth === 'number') {
            opts.maxDepth = depth;
        }
        if (!(opts.maxDepth >= 0)) {
            opts.maxDepth = Number.POSITIVE_INFINITY;
        }

        let files: FileInfo[] = [];
        this.recursiveFilterFiles(path, files, 0, opts);
        return files;
    }

    loadFile(file: FileInfo): any {
        let module = this.require(file);

        return this.processModule({ module, file });
    }

    protected transform(data: any[]): any {
        return data;
    }

    protected recursiveFilterFiles(path: string, files: FileInfo[], depth: number, opts: RecursiveFilterFilesOptions) {
        let dirs: string[] = [];
        let list = fs.readdirSync(path);

        list.forEach(name => {
            let absolutePath = Path.join(path, name);
            let type = this.checkFileType(absolutePath);

            if (type === FileType.File) {
                let dirname = this.getDirname(absolutePath, opts.basePath);
                let basename = this.getBasename(absolutePath);
                if (this.filterFile(absolutePath, dirname, basename)) {
                    files.push({ absolutePath, dirname, basename });
                }

            } else if (type === FileType.Directory) {
                if (this.filterDir(absolutePath, opts.basePath)) {
                    dirs.push(absolutePath);
                }
            }
        });

        if (depth >= opts.maxDepth) {
            return;
        }

        depth++;
        dirs.forEach(dir => this.recursiveFilterFiles(dir, files, depth, opts));
    }

    protected getDirname(absolutePath: string, basePath: string) {
        return Path.dirname(Path.relative(basePath, absolutePath));
    }

    protected getBasename(absolutePath: string) {
        return Path.basename(absolutePath, this.ext);
    }

    protected checkFileType(path: string) {
        let stat = fs.statSync(path);

        if (stat.isFile()) return FileType.File;
        if (stat.isDirectory()) return FileType.Directory;
        return FileType.Other;
    }

    protected filterFile(absolutePath: string, _dirname: string, _basename: string): boolean {
        return this.fileFilter.test(absolutePath);
    }

    protected filterDir(absolutePath: string, basePath: string): boolean {
        return this.dirFilter.test(Path.relative(basePath, absolutePath));
    }

    protected require(file: FileInfo): any {
        return require(file.absolutePath);
    }

    protected processModule(moduleInfo: ModuleInfo): any {
        this.emit('processModule', moduleInfo);
        return moduleInfo;
    }
}

export interface ClassLoaderOptions extends LoaderOptions {
    defaultExportedClass?: string;
    instantiationOpts?: any;

    getClass?: (moduleInfo: ModuleInfo) => ClassConstructor;
    processClass?: <T extends InstanceInfo>(Class: ClassConstructor, moduleInfo: ModuleInfo) => T | null;
    instantiate?: (Class: ClassConstructor) => any;
    processInstance?: <T extends InstanceInfo>(info: T) => any;
}

export class ClassLoader extends FileLoader {
    defaultExportedClass = 'default';
    instantiationOpts: any;

    constructor(opts?: ClassLoaderOptions) {
        super(opts);

        this.override([
            'defaultExportedClass',
            'instantiationOpts',
            'getClass',
            'processClass',
            'instantiate',
            'processInstance'
        ], opts);
    }

    protected processModule(moduleInfo: ModuleInfo) {
        let Class = this.getClass(moduleInfo);
        if (!Class) {
            return;
        }

        let instanceInfo = this.processClass(Class, moduleInfo);

        if (instanceInfo) {
            return this.processInstance(instanceInfo);
        }
    }

    protected getClass(moduleInfo: ModuleInfo): ClassConstructor {
        if (this.defaultExportedClass) {
            return moduleInfo.module[this.defaultExportedClass];
        } else {
            return moduleInfo.module;
        }
    }

    protected processClass(Class: ClassConstructor, moduleInfo: ModuleInfo): InstanceInfo | null {
        let instance = this.instantiate(Class);

        if (!instance) {
            return null;
        }

        return {
            Class,
            instance,
            file: moduleInfo.file
        };
    }

    protected instantiate(Class: ClassConstructor) {
        return new Class(this.instantiationOpts);
    }

    protected processInstance(instanceInfo: InstanceInfo): any {
        this.emit('processInstance', instanceInfo);
        return instanceInfo;
    }
}
