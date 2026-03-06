#!/bin/sh
# Patch nginx to listen on Render's PORT (defaults to 80 locally)
sed -i "s/listen 80;/listen ${PORT:-80};/g" /etc/nginx/conf.d/default.conf

# Start supervisord (nginx + bun API)
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
