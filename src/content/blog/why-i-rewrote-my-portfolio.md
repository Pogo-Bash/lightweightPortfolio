---
title: "Why I Rewrote My Portfolio (Again)"
description: "Less Three.js, more substance. Sometimes simpler is better."
date: 2026-03-18
---

My old portfolio had a 3D animated name, a particle system, a visitor counter with its own API and database, and a grid background that subtly glowed green.

It was cool. It was also completely useless.

## The problem

Nobody visiting my portfolio cared about my Three.js skills. They wanted to know who I am, what I've built, and how to reach me. Instead they got a loading spinner while 200KB of JavaScript figured out how to render my name in 3D.

## The fix

Strip it all out. Astro, Tailwind, static HTML. No React. No Three.js. No visitor counter. No API. Just text on a page that loads instantly and actually tells you something.

## Lessons

- **If your portfolio needs a loading screen, you've gone too far.**
- Ship something that works for the person reading it, not the person who built it.
- You can always add complexity later. You can rarely remove it gracefully.

The source is on [GitHub](https://github.com/Pogo-Bash/lightweightPortfolio) if you want to see what "simple" looks like.
