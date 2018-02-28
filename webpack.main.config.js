/**
 * Created by mac on 18/2/26.
 */
'use strict'

process.env.BABEL_ENV = 'main'

const path = require('path')
const { dependencies } = require('./package.json')
const webpack = require('webpack')

//生产环境模式下压缩js文件
const BabiliWebpackPlugin = require('babili-webpack-plugin')

let mainConfig = {
    entry: {
        main: path.join(__dirname, './main.js')
    },
    externals: [
        ...Object.keys(dependencies || {})
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                use: 'babel-loader',
                exclude: /node_modules/
            },
            {
                test: /\.node$/,
                use: 'node-loader'
            }
        ]
    },
    node: {
        __dirname: process.env.NODE_ENV !== 'production',
        __filename: process.env.NODE_ENV !== 'production'
    },
    output: {
        filename: '[name].bundle.js',
        libraryTarget: 'commonjs2',
        path: path.join(__dirname, './')
    },
    plugins: [
        new webpack.NoEmitOnErrorsPlugin()
    ],
    resolve: {
        extensions: ['.js', '.json', '.node']
    },
    target: 'electron-main'
}

/**
 * Adjust mainConfig for production settings
 */
if (process.env.NODE_ENV === 'production') {
    mainConfig.plugins.push(
        new BabiliWebpackPlugin(),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': '"production"'
        })
    )
}

module.exports = mainConfig
