import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Korean Mafia Game landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /<title>밤의 의회 — 마피아 게임<\/title>/i);
  assert.match(html, /믿지 마라/);
  assert.match(html, /살아남아라/);
  assert.match(html, /솔로 게임 시작/);
  assert.match(html, /온라인 듀오/);
  assert.match(html, /\/mafia-icon\.png/);
  assert.doesNotMatch(html, /codex-preview|Starter Project|site is taking shape/i);
});

test("contains the real game client and no disposable starter preview", async () => {
  const [page, layout, game] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MafiaGame.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<MafiaGame \/>/);
  assert.match(layout, /lang="ko"/);
  assert.match(layout, /mafia-icon\.png/);
  assert.match(game, /^"use client";/);
  assert.match(game, /createGame/);
  assert.match(game, /autoPlayAi/);
  assert.match(game, /joinOnlineRoom/);
  assert.match(game, /view\.characters\.map/);
  assert.match(game, /무승부/);
  assert.match(
    game,
    /\(isMafiaNight \|\| isCultNight\) &&\s*selected\.id === view\.partner\?\.id/s,
  );
  assert.doesNotMatch(page, /_sites-preview|codex-preview/i);
  await assert.rejects(
    access(new URL("../app/_sites-preview/", templateRoot)),
  );
});
