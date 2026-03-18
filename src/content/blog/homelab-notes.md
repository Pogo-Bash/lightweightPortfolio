---
title: "Homelab Notes: Docker, Mistakes, and DNS"
description: "A running log of things I've learned from running my own infrastructure."
date: 2026-02-20
---

I've been running a homelab for a while now. Here are some things I wish someone told me earlier.

## DNS will always be the problem

It doesn't matter what's broken. The answer is DNS. I've spent more hours debugging DNS than any other single thing in my life. Set up Pi-hole early and save yourself the pain.

## Docker Compose is your friend

Stop writing raw `docker run` commands with 15 flags. Write a `docker-compose.yml`, commit it to a repo, and move on. Future you will thank present you.

## Backups aren't optional

I lost a Postgres database once because I thought "it's just a homelab, who cares." Turns out I cared a lot when two weeks of config was gone. Now everything gets backed up to a second drive automatically.

## Start small

You don't need Kubernetes at home. You need a single machine running Docker with a reverse proxy. Scale when you actually need to, not when Hacker News tells you to.
