FROM node:current-alpine

# Installs latest Chromium (63) package.
RUN apk update && apk upgrade && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk add --no-cache \
      chromium@edge \
      nss@edge

RUN addgroup -S webapp && adduser -S -g webapp webapp \
    && mkdir /webapp \
    && chown -R webapp:webapp /webapp

USER webapp
WORKDIR /webapp/
ADD *.ts *.json yarn.lock /webapp/

RUN yarn

ENTRYPOINT [ "/bin/sh", "-c", "yarn start" ]
