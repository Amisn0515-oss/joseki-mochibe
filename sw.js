/* =========================================================================
   サービスワーカー
   アプリの見た目と動きを丸ごと端末に置いておくための係。
   これがあると、電波がなくても起動できる。

   直したいとき：下の VERSION の数字を1つ上げて保存してください。
   数字が変わると古い置き場を捨てて入れ直すので、変更がちゃんと反映されます。

   モチの絵を足した・差しかえただけのときは、上げなくて大丈夫です。
   絵は別の置き場（IMGSTORE）に入れてあり、版を上げても捨てません。
   アプリが開くたびに、足りない絵だけを静かにためます。
   ========================================================================= */
const VERSION = "v47";
const STORE = `joseki-mochibe-${VERSION}`;
/* モチの絵の置き場。こちらは版をまたいで残す。
   絵は中身が変わらないので、アプリを直すたびに取り直す必要がない。
   絵を差しかえたときは、ファイル名が変わるので自然に入れ替わる。 */
const IMGSTORE = "joseki-mochibe-img";
const IMGDIR = "/mochi/";

// 最初にまとめて置いておくもの
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./mochi/list.json",        // どのモチがどの絵か。絵そのものは下で裏からためる
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
      .then((ks) => Promise.all(
        ks.filter((k) => k !== STORE && k !== IMGSTORE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => keepImages())
  );
});

/* 取りに行きかた。
   まずネットを見に行き、取れたら置き場を新しくする。
   取れなければ置き場のぶんを返す（＝オフラインでも動く）。
   こうしておくと、更新したときに古い画面が残り続けない。          */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;  // 外のフォントなどは素通し

  /* モチの絵は、置き場にあればそれを返す（ネットに行かない）。
     中身が変わらないものなので、毎回たしかめる意味がない。      */
  if (u.pathname.includes(IMGDIR) && u.pathname.endsWith(".webp")) {
    e.respondWith(
      caches.open(IMGSTORE).then((c) =>
        c.match(req).then((hit) =>
          hit || fetch(req).then((res) => {
            if (res.ok) c.put(req, res.clone());
            return res;
          })
        )
      )
    );
    return;
  }

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

/* アプリから「list を読んだ」と伝えてもらったら、足りない絵をためる。
   モチを足したときに、版を上げなくてもオフラインに追いつけるように */
self.addEventListener("message", (e) => {
  if (e.data && e.data.t === "keepImages") e.waitUntil(keepImages());
});

/* 絵を、裏でまとめてためておく。
   電波がないときでもモチが出るように。1枚8KBほどなので、
   足したぶんだけ、次に開いたときに静かに増える。            */
function keepImages() {
  return fetch("./mochi/list.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((list) => {
      if (!list) return;
      return caches.open(IMGSTORE).then((c) => {
        const names = Object.keys(list).map((k) => "./mochi/" + list[k][3]);
        // 1枚ずつ。失敗しても、ほかの絵を止めない
        return names.reduce(
          (p, n) => p.then(() =>
            c.match(n).then((hit) => (hit ? null : c.add(n).catch(() => {})))),
          Promise.resolve()
        );
      });
    })
    .catch(() => {});
}
