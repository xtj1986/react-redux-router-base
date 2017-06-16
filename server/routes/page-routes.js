/**
 * 页面路由配置
 */
const fs = require('fs');
const path = require('path');
const serialize = require('serialize-javascript');
const handlebars = require('handlebars');
const httpTool = require('./../helper/utils');
const logger = require('../helper/mylogger').Logger;
const {URL_CONTEXT} = require('../config');

//services
const isDev = process.env.NODE_ENV === 'development';
//页面上下文，根路径，nginx 会卸载掉前缀 context
const context = process.env.NODE_ENV === 'product' ? '' : URL_CONTEXT;

//加载webpack打包后的静态文件映射表
const fileMapping = isDev ? null : require('../../public/dist/mapping.json');

//静态文件上下文路径
const staticResourceContext = `${URL_CONTEXT}/dist/`;

//加载html模板
const htmlTemplate = function (path) {
  return handlebars.compile(fs.readFileSync(path, {encoding: 'utf8'}));
}(path.join(__dirname, '../views/layout.hbs'));

/**
 * 将页面初始值转换为scrip脚本，添加到data.scriptHtml属性中
 * @param data
 */
const wrapScriptHtml = function (data) {

  // 应该把所有的初始化数据都放到 __initialState__ 中，client 生成 store 时，传入该数据
  if (data.initDatas) {
    const scriptHtml = `window.__initialState__=${serialize(data.initDatas)};`;
    data.scriptHtml = scriptHtml;
    delete data.initDatas;
  }

  // 设置二级路径上下文
  data.context = URL_CONTEXT;

  /*if (data.initDatas) {
   let scriptHtml = [];
   Object.keys(data.initDatas).forEach((key) => {
   let value = data.initDatas[key];
   value = typeof value === 'string' ? `'${value}'` : JSON.stringify(value);
   scriptHtml.push(`window.${key}=${value}`);
   });
   data.scriptHtml = scriptHtml.join(';');
   scriptHtml = null;
   delete data.initDatas;
   }*/
};
/**
 * 构建页面样式表，添加到data.links属性中
 * @param data
 * @param isDev
 * @param mapping
 */
const wrapStyleImports = function (data, isDev, mapping) {
  const buildLink = function (href) {
    return `<link href="${href}" rel="stylesheet">`;
  };
  if (!isDev) {
    data.links = `${buildLink(mapping[`${staticResourceContext}${data.name}.css`])}`;
  }
};

/**
 * 构建页面外链脚本，添加到data.scripts属性中
 * @param data
 * @param isDev
 * @param mapping
 */
const wrapScriptImports = function (data, isDev, mapping) {
  const buildScript = function (src) {
    return `<script src="${src}"></script>`;
  };
  if (isDev) {
    data.scripts = `${buildScript(`${URL_CONTEXT}/dll/vendor.dll.js`)}
         ${buildScript(`${staticResourceContext}${data.name}.bundle.js`)}`;
  } else {
    data.scripts = `${buildScript(mapping[`${staticResourceContext}manifest.js`])}
        ${buildScript(mapping[`${staticResourceContext}vendor.js`])}
        ${buildScript(mapping[`${staticResourceContext}${data.name}.js`])}`;
  }
};
/**
 * 设置通用的响应头,页面不缓存！！
 * @param response
 */
const setCommonHeader = function (response) {
  response.setHeader('cache-control', 'no-cache, no-store');
  response.setHeader('content-type', 'text/html; charset=UTF-8');
};

/**
 * 根据页面模型数据渲染页面模板
 * @param request
 * @param response
 * @param data
 * {
 *    title, //页面标题<必须>
 *    name,  //页面在webpack entry中对应的名称<必须>
 *    initDatas:{
 *        _pageInitData,others...
 *    }
 * }
 */
const renderTemplateSync = function (request, response, data) {
  setCommonHeader(response);

  wrapScriptHtml(data);
  wrapStyleImports(data, isDev, fileMapping);
  wrapScriptImports(data, isDev, fileMapping);
  /*
   * data 结构：
   *     { title,name,scriptHtml,links,scripts,context }
   */
  response.end(htmlTemplate(data));
};

/**
 * 渲染首页
 * 会根据返回数据决定展示小白分页或系统欢迎页
 * @param req
 * @param res
 * @param next
 */
const renderIndex = function (req, res, next) {
  renderTemplateSync(req, res, {
    title: 'Home Page',
    name: 'home'
  });
};

function addRoute(app, options) {

  //组件测试
  app.get(`${context}/page1**`, (req, res, next) => {
    renderTemplateSync(req, res, {
      title: 'Page1',
      name: 'page1'
    });
  });
  //组件测试
  app.get(`${context}/page2**`, (req, res, next) => {
    renderTemplateSync(req, res, {
      title: 'Page2',
      name: 'page2'
    });
  });
  //组件测试
  app.get(`${context}/about**`, (req, res, next) => {
    renderTemplateSync(req, res, {
      title: 'About Page',
      name: 'about'
    });
  });
  app.get(`${context}/`, (req, res, next) => {
    if (req.method === 'GET') { // head请求也会拦截到，在线上nginx会以head请求发送心跳请求
      renderIndex(req, res, next);
    } else {
      res.end('ok');
    }
  });

  // 将未知的页面请求重定向到首页
  app.get('*', (req, res, next) => {
    if (/\.{1}(ico|png|jpg|gif|svg|js|css|map|json)(\?.*|$)/.test(req.url)) {
      return next();
    }
    logger.info(`unknow resource,redirect to /,request url : ${req.url}`);

    renderIndex(req, res, next);
  });
}

module.exports = addRoute;
