FROM node:current-stretch

RUN apt-get -y update && apt-get -y install build-essential chromium libatk-bridge2.0-0 libharfbuzz-bin libgtk-3-0
RUN groupadd webapp && useradd -g webapp -d /webapp/ webapp

ADD *.ts *.json yarn.lock /webapp/

RUN chown -R webapp:webapp /webapp/

# FIX for case-sensitive fs issue with node-geogebra
RUN su webapp -lc "yarn && mv /webapp/node_modules/node-geogebra/geogebra-math-apps-bundle/GeoGebra /webapp/node_modules/node-geogebra/geogebra-math-apps-bundle/Geogebra"

USER webapp
WORKDIR /webapp/

ENTRYPOINT [ "/bin/sh", "-c", "yarn start" ]
