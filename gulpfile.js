const { src, dest, series } = require('gulp');
const filter = require('gulp-filter');
const zip = require('gulp-zip');
const ngPackagr = require('ng-packagr');
const fs = require('fs-extra');
const del = require('del');
const execSync = require('child_process').execSync;
const replace = require('gulp-replace');
const path = require('path');
const bump = require('gulp-bump');



/**
 * Remove dist folder ready for next build 
 */
function clean() {
    return del(['dist']);
}

/**
 *  Series of functions that compile the target
 *  if we are building then bump the "patch" number 
 *  build angular parts , webpack and styles. 
 */
const compile = series(
    //increase patch
    function () {
        return src('./package.json')
            .pipe(bump())
            .pipe(dest('./'));
    },
    function buildAngularLibrary() {
        return ngPackagr.ngPackagr()
            .forProject('./ng-package.json')
            .withTsConfig('./tsconfig.rt.json')
            .build()
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
    },
    function separateWebpackBuildSrc() { return fs.copy('./dist/widget-library/fesm5', './dist/bundle-src'); },
    function replaceStylePath() {
        return src('./dist/widget-library/**/*')
            .pipe(replace(/~styles/g, function () {
                return path.relative(this.file.dirname, './dist/widget-library/styles').replace(/\\/g, '/');
            }))
            .pipe(dest('./dist/widget-library/'));
    },
    async function packLibrary() { return execSync("npm pack ./widget-library", { cwd: './dist', stdio: 'inherit' }); }
);

const compileNoBump = series(
    function buildAngularLibrary() { return ngPackagr.build({ project: './ng-package.json' }); },
    function separateWebpackBuildSrc() { return fs.copy('./dist/widget-library/fesm5', './dist/bundle-src'); },
    function replaceStylePath() {
        return src('./dist/widget-library/**/*')
            .pipe(replace(/~styles/g, function () {
                return path.relative(this.file.dirname, './dist/widget-library/styles').replace(/\\/g, '/');
            }))
            .pipe(dest('./dist/widget-library/'));
    },
    async function packLibrary() { return execSync("npm pack ./widget-library", { cwd: './dist', stdio: 'inherit' }); }
);

/**
 * Create the webpack build include the relvent items and zip it.
 */
const bundle = series(
    async function webpackBuild() { return execSync("npx webpack", { stdio: 'inherit' }); },
    function copyCumulocityJson() { return fs.copy('./widget-cumulocity.json', './dist/widget/cumulocity.json'); },
    function createZip() {
        const pkgJson = require('./dist/widget-library/package.json');//need bumped version.
        return src('./dist/widget/**/*')
            // Filter out the webpackRuntime chunk, we only need the widget code chunks
            .pipe(filter(file => !/^[a-f0-9]{20}\.js(\.map)?$/.test(file.relative)))
            .pipe(zip(`${pkgJson.name}-${pkgJson.version}.zip`))
            .pipe(dest('dist/'));
    }
);

const bundleRelease = series(
    async function webpackBuild() { return execSync("npx webpack", { stdio: 'inherit' }); },
    function copyCumulocityJson() { return fs.copy('./widget-cumulocity.json', './dist/widget/cumulocity.json'); },
    function createZip() {
        const pkgJson = require('./dist/widget-library/package.json');//need bumped version.
        return src('./dist/widget/**/*')
            // Filter out the webpackRuntime chunk, we only need the widget code chunks
            .pipe(filter(file => !/^[a-f0-9]{20}\.js(\.map)?$/.test(file.relative)))
            .pipe(zip(`${pkgJson.name}-${pkgJson.version}.zip`))
            .pipe(dest('release/'));
    }
);

exports.clean = clean;
exports.build = compile;
exports.bundle = bundle;

/**
 * simply running gulp starts this series 
 */
exports.default = series(clean, compile, bundle, async function success() {
    console.log("Build Finished Successfully!");
    const pkgJson = require('./dist/widget-library/package.json');
    console.log(`Runtime Widget Output (Install in the browser): dist/${pkgJson.name}-${pkgJson.version}.zip`);
    console.log(`Widget Angular Library (Install with: "npm i <filename.tgz>"): dist/${pkgJson.name}-${pkgJson.version}.tgz`);
});

exports.release = series(clean, compileNoBump, bundle, async function success() {
    console.log("Build Finished Successfully!");
    const pkgJson = require('./dist/widget-library/package.json');
    console.log(`Runtime Widget Output (Install in the browser): dist/${pkgJson.name}-${pkgJson.version}.zip`);
    console.log(`Widget Angular Library (Install with: "npm i <filename.tgz>"): dist/${pkgJson.name}-${pkgJson.version}.tgz`);
});
