import * as assert from 'assert';
import { FileLoader, ClassLoader, FileInfo } from '../';

describe('Loader', () => {
    describe('FileLoader', () => {
        it('load all module', () => {
            let loader = new FileLoader({ cwd: __dirname, ext: '.ts', fileFilter: /.*\.ts$/i });
            let result: { module: { default: Function; }; file: FileInfo }[] = loader.load('./fixtures');

            assert.equal(result.length, 2);

            assert.equal(result[0].file.basename, 'hello');
            assert.equal(result[0].file.dirname, '.');
            assert.equal(typeof result[0].module.default, 'function');
            assert.equal(result[0].module.default.name, 'Hello');

            assert.equal(result[1].file.basename, 'world');
            assert.equal(result[1].file.dirname, 'common');
            assert.equal(typeof result[1].module.default, 'function');
            assert.equal(result[1].module.default.name, 'World');
        });
    });

    describe('ClassLoader', () => {
        it('load all class and instance', () => {
            let loader = new ClassLoader({ cwd: __dirname, ext: '.ts', fileFilter: /.*\.ts$/i });
            let result: { Class: Function; instance: { name: string; }; file: FileInfo }[] = loader.load('./fixtures');

            assert.equal(result.length, 2);

            assert.equal(result[0].file.basename, 'hello');
            assert.equal(result[0].file.dirname, '.');
            assert.equal(typeof result[0].Class, 'function');
            assert.equal(result[0].Class.name, 'Hello');
            assert.equal(result[0].instance.name, 'hello');

            assert.equal(result[1].file.basename, 'world');
            assert.equal(result[1].file.dirname, 'common');
            assert.equal(typeof result[1].Class, 'function');
            assert.equal(result[1].Class.name, 'World');
            assert.equal(result[1].instance.name, 'world');
        });
    });
});
