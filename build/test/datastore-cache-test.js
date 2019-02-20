/*
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const Koa = require("koa");
const koaCompress = require("koa-compress");
const request = require("supertest");
const route = require("koa-route");
const datastore_cache_1 = require("../datastore-cache");
const app = new Koa();
const server = request(app.listen());
const cache = new datastore_cache_1.DatastoreCache();
app.use(route.get('/compressed', koaCompress()));
app.use(cache.middleware());
let handlerCalledCount = 0;
ava_1.test.before(async () => {
    await cache.clearCache();
});
app.use(route.get('/', (ctx) => {
    handlerCalledCount++;
    ctx.body = `Called ${handlerCalledCount} times`;
}));
const promiseTimeout = function (timeout) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
};
ava_1.test('caches content and serves same content on cache hit', async (t) => {
    let res = await server.get('/?basictest');
    const previousCount = handlerCalledCount;
    t.is(res.status, 200);
    t.is(res.text, 'Called ' + previousCount + ' times');
    // Workaround for race condition with writing to datastore.
    await promiseTimeout(500);
    res = await server.get('/?basictest');
    t.is(res.status, 200);
    t.is(res.text, 'Called ' + previousCount + ' times');
    t.truthy(res.header['x-rendertron-cached']);
    t.true(new Date(res.header['x-rendertron-cached']) <= new Date());
    res = await server.get('/?basictest');
    t.is(res.status, 200);
    t.is(res.text, 'Called ' + previousCount + ' times');
    res = await server.get('/?basictest2');
    t.is(res.status, 200);
    t.is(res.text, 'Called ' + (previousCount + 1) + ' times');
});
app.use(route.get('/set-header', (ctx) => {
    ctx.set('my-header', 'header-value');
    ctx.body = 'set-header-payload';
}));
ava_1.test('caches headers', async (t) => {
    let res = await server.get('/set-header');
    t.is(res.status, 200);
    t.is(res.header['my-header'], 'header-value');
    t.is(res.text, 'set-header-payload');
    // Workaround for race condition with writing to datastore.
    await promiseTimeout(500);
    res = await server.get('/set-header');
    t.is(res.status, 200);
    t.is(res.header['my-header'], 'header-value');
    t.is(res.text, 'set-header-payload');
});
app.use(route.get('/compressed', (ctx) => {
    ctx.set('Content-Type', 'text/html');
    ctx.body = new Array(1025).join('x');
}));
ava_1.test('compression preserved', async (t) => {
    const expectedBody = new Array(1025).join('x');
    let res = await server.get('/compressed')
        .set('Accept-Encoding', 'gzip, deflate, br');
    t.is(res.status, 200);
    t.is(res.header['content-encoding'], 'gzip');
    t.is(res.text, expectedBody);
    // Workaround for race condition with writing to datastore.
    await promiseTimeout(500);
    res = await server.get('/compressed')
        .set('Accept-Encoding', 'gzip, deflate, br');
    t.is(res.status, 200);
    t.is(res.header['content-encoding'], 'gzip');
    t.is(res.text, expectedBody);
});
let statusCallCount = 0;
app.use(route.get('/status/:status', (ctx, status) => {
    // Every second call sends a different status.
    if (statusCallCount % 2 === 0) {
        ctx.status = Number(status);
    }
    else {
        ctx.status = 401;
    }
    statusCallCount++;
}));
ava_1.test('original status is preserved', async (t) => {
    let res = await server.get('/status/400');
    t.is(res.status, 400);
    // Non 200 status code should not be cached.
    res = await server.get('/status/400');
    t.is(res.status, 401);
});
//# sourceMappingURL=datastore-cache-test.js.map