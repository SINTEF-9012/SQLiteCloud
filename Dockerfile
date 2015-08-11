FROM node:0.12-onbuild

EXPOSE 8080

ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update
RUN apt-get install -y sqlite3

CMD [ "npm", "start" ]