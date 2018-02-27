/**
 * Created by mac on 18/2/26.
 */
'use strict';

const path = require('path');
const webpack = require('webpack');

module.exports ={
    target: 'electron-renderer',
    entry: {
        index: './index/index'
    },
    output: {
        path: path.join(__dirname, 'index'),
        filename: '[name].bundle.js'
    },
    module: {
        rules: []
    },
};