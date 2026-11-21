// @ts-nocheck

import { useEffect } from 'react';

const useCanvasCursor = () => {
  function Oscillator(e) {
    this.init(e || {});
  }
  Oscillator.prototype = {
    init: function (e) {
      this.phase = e.phase || 0;
      this.offset = e.offset || 0;
      this.frequency = e.frequency || 0.001;
      this.amplitude = e.amplitude || 1;
    },
    update: function () {
      this.phase += this.frequency;
      currentHue = this.offset + Math.sin(this.phase) * this.amplitude;
      return currentHue;
    },
    value: function () {
      return currentHue;
    }
  };

  function Line(e) {
    this.init(e || {});
  }

  Line.prototype = {
    init: function (e) {
      this.spring = e.spring + 0.1 * Math.random() - 0.02;
      this.friction = config.friction + 0.01 * Math.random() - 0.002;
      this.nodes = [];
      for (var t, n = 0; n < config.size; n++) {
        t = new Node();
        t.x = pos.x;
        t.y = pos.y;
        this.nodes.push(t);
      }
    },
    update: function () {
      var e = this.spring,
        t = this.nodes[0];
      t.vx += (pos.x - t.x) * e;
      t.vy += (pos.y - t.y) * e;
      for (var n, i = 0, a = this.nodes.length; i < a; i++) {
        t = this.nodes[i];
        if (0 < i) {
          n = this.nodes[i - 1];
          t.vx += (n.x - t.x) * e;
          t.vy += (n.y - t.y) * e;
          t.vx += n.vx * config.dampening;
          t.vy += n.vy * config.dampening;
        }
        t.vx *= this.friction;
        t.vy *= this.friction;
        t.x += t.vx;
        t.y += t.vy;
        e *= config.tension;
      }
    },
    draw: function () {
      var e,
        t,
        n = this.nodes[0].x,
        i = this.nodes[0].y;
      ctx.beginPath();
      ctx.moveTo(n, i);
      for (var a = 1, o = this.nodes.length - 2; a < o; a++) {
        e = this.nodes[a];
        t = this.nodes[a + 1];
        n = 0.5 * (e.x + t.x);
        i = 0.5 * (e.y + t.y);
        ctx.quadraticCurveTo(e.x, e.y, n, i);
      }
      e = this.nodes[a];
      t = this.nodes[a + 1];
      ctx.quadraticCurveTo(e.x, e.y, t.x, t.y);
      ctx.stroke();
      ctx.closePath();
    }
  };

  function Node() {
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
  }

  var ctx,
    oscillator,
    currentHue = 0,
    pos = { x: 0, y: 0 },
    lines = [],
    config = {
      friction: 0.5,
      trails: 20,
      size: 50,
      dampening: 0.25,
      tension: 0.98
    };

  function updatePos(e) {
    if (e.touches) {
      pos.x = e.touches[0].pageX;
      pos.y = e.touches[0].pageY;
    } else {
      pos.x = e.clientX;
      pos.y = e.clientY;
    }
  }

  function onTouchSingle(e) {
    if (e.touches && e.touches.length === 1) {
      pos.x = e.touches[0].pageX;
      pos.y = e.touches[0].pageY;
    }
  }

  function render() {
    if (ctx && ctx.running) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.strokeStyle = 'hsla(' + Math.round(oscillator.update()) + ',75%,50%,0.35)';
      ctx.lineWidth = 1;
      for (var i = 0; i < config.trails; i++) {
        var line = lines[i];
        line.update();
        line.draw();
      }
      ctx.frame++;
      window.requestAnimationFrame(render);
    }
  }

  function onFirstMove(e) {
    lines = [];
    for (var i = 0; i < config.trails; i++) {
      lines.push(new Line({ spring: 0.4 + (i / config.trails) * 0.025 }));
    }
    document.removeEventListener('mousemove', onFirstMove);
    document.removeEventListener('touchstart', onFirstMove);
    document.addEventListener('mousemove', updatePos);
    document.addEventListener('touchmove', updatePos);
    document.addEventListener('touchstart', onTouchSingle);
    updatePos(e);
    render();
  }

  function resizeCanvas() {
    if (ctx && ctx.canvas) {
      ctx.canvas.width = window.innerWidth;
      ctx.canvas.height = window.innerHeight;
    }
  }

  function handleFocus() {
    if (ctx && !ctx.running) {
      ctx.running = true;
      render();
    }
  }

  function handleBlur() {
    if (ctx) ctx.running = true;
  }

  useEffect(() => {
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) return;
    ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.running = true;
    ctx.frame = 1;
    oscillator = new Oscillator({
      phase: Math.random() * 2 * Math.PI,
      amplitude: 85,
      frequency: 0.0015,
      offset: 285
    });

    document.addEventListener('mousemove', onFirstMove);
    document.addEventListener('touchstart', onFirstMove);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    resizeCanvas();

    return () => {
      if (ctx) ctx.running = false;
      document.removeEventListener('mousemove', onFirstMove);
      document.removeEventListener('touchstart', onFirstMove);
      document.removeEventListener('mousemove', updatePos);
      document.removeEventListener('touchmove', updatePos);
      document.removeEventListener('touchstart', onTouchSingle);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
};

export default useCanvasCursor;
