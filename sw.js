/* =========================================================================
   サービスワーカー
   アプリの見た目と動きを丸ごと端末に置いておくための係。
   これがあると、電波がなくても起動できる。

   直したいとき：下の VERSION の数字を1つ上げて保存してください。
   数字が変わると古い置き場を捨てて入れ直すので、変更がちゃんと反映されます。
   ========================================================================= */
const VERSION = "v29";
const STORE = `joseki-mochibe-${VERSION}`;

// 最初にまとめて置いておくもの
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

// 置き場をつくる
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STORE)
      // 1つ失敗しても全部が止まらないように、1件ずつ入れる
      .then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// 古い置き場を片づける
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== STORE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 取りに行きかた。
   まずネットを見に行き、取れたら置き場を新しくする。
   取れなければ置き場のぶんを返す（＝オフラインでも動く）。
   こうしておくと、更新したときに古い画面が残り続けない。          */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;  // 外のフォントなどは素通し

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(STORE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match("./index.html"))
      )
  );
});
