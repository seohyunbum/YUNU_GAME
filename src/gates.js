/* 게이트: 라스트워식 병력 연산 문(+, ×, -, ÷). 문 하나만 통과한다. */
(function (global) {
  'use strict';
  const LW = (global.LW = global.LW || {});

  const OPS = ['add', 'mul', 'sub', 'div'];

  function apply(count, gate) {
    const max = LW.config.squad.maxCount;
    let next = count;
    switch (gate.op) {
      case 'add':
        next = count + gate.value;
        break;
      case 'mul':
        next = Math.floor(count * gate.value);
        break;
      case 'sub':
        next = count - gate.value;
        break;
      case 'div':
        next = Math.floor(count / gate.value);
        break;
      default:
        next = count;
    }
    return LW.util.clamp(next, 0, max);
  }

  function label(gate) {
    switch (gate.op) {
      case 'add':
        return '+' + gate.value;
      case 'mul':
        return '×' + gate.value;
      case 'sub':
        return '−' + gate.value;
      case 'div':
        return '÷' + gate.value;
      default:
        return '?';
    }
  }

  /** 실제로 이득인가 — 겉모습(fake)과 무관하게 숫자로만 판단한다. */
  function isBuff(gate) {
    if (gate.op === 'add') return gate.value > 0;
    if (gate.op === 'mul') return gate.value > 1;
    return false;
  }

  /** 겉모습만 이득처럼 보이는 문(페이크)인가 — 색은 초록인데 결과는 손해다. */
  function looksBuff(gate) {
    return gate.fake === true || isBuff(gate);
  }

  /**
   * 현재 예상 병력에 맞춰 문 두 개를 만든다.
   * 한쪽은 확실히 이득, 한쪽은 확실히 손해 — 고민할 가치가 있게 값을 맞춘다.
   * expected 가 커지면 더하기 값도 같이 커져서 후반에도 의미가 있다.
   */
  function makePair(rng, expected, stage, opts) {
    const scale = Math.max(4, Math.round(expected * 0.45));
    const buffs = [
      { op: 'add', value: rng.int(Math.max(3, Math.round(scale * 0.5)), Math.max(6, scale)) },
      { op: 'add', value: rng.int(Math.max(5, scale), Math.max(9, Math.round(scale * 1.6))) },
      { op: 'mul', value: 2 },
      { op: 'mul', value: rng.chance(0.25 + stage * 0.02) ? 3 : 2 },
    ];
    const nerfs = [
      { op: 'sub', value: rng.int(Math.max(3, Math.round(scale * 0.4)), Math.max(7, scale)) },
      { op: 'div', value: 2 },
      { op: 'div', value: rng.chance(0.3) ? 3 : 2 },
    ];
    const buff = rng.pick(buffs);
    let nerf = rng.pick(nerfs);

    // 페이크 문: 초록으로 보이지만 실제로는 손해다. 문 아래 병력 미리보기는 정직하다
    // — "색이 아니라 숫자를 읽어라" 를 가르치는 장치.
    if (opts && opts.allowFake && stage >= 3 && rng.chance(0.6)) {
      nerf = rng.chance(0.5)
        ? { op: 'mul', value: 0, fake: true } // ×0 — 통과하면 전멸
        : { op: nerf.op, value: nerf.value, fake: true };
    }
    // 좌우 배치는 무작위 — 아이가 매번 읽고 판단해야 한다.
    return rng.chance(0.5) ? [buff, nerf] : [nerf, buff];
  }

  LW.gates = { OPS, apply, label, isBuff, looksBuff, makePair };
})(typeof globalThis !== 'undefined' ? globalThis : this);
