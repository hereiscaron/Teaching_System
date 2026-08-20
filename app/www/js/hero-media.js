/* 烟洲中学校园实景图（本地文件资源，替代原 AI 生成校园背景图）
 * 压缩后的图片位于 app/assets/yanzhou.jpg（约 100KB，原图 1.1MB 已重采样）。
 * 通过 --hero-image 变量供 .campus-backdrop 使用；
 * url() 相对引用以使用处（css/ 目录）解析，故使用 ../assets/yanzhou.jpg。
 */
(function () {
  document.documentElement.style.setProperty('--hero-image', 'url("../assets/yanzhou.jpg")');
})();
