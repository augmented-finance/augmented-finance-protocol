FROM node:14
COPY package.json yarn.lock /src/
WORKDIR /src
RUN yarn install
COPY . /src/
RUN yarn compile
CMD ["npx", "hardhat", "node"]
