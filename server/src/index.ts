import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { createServer } from "http";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import express from "express";
import cors from "cors";
import { PubSub } from "graphql-subscriptions";

// Graphql stuff ---------------------------------------
const typeDefs = `#graphql
    type Query {
        currentNum: Int
    }

    type Mutation{
        incrementNumber(num: Int!): Int
    }


    type Subscription {
        numberIncremented: Int
    }
`;

// Graphql stuff ---------------------------------------

const app = express();
const httpServer = createServer(app);
const pubsub = new PubSub();

let currentNum = 0;

const resolvers = {
  Query: {
    currentNum() {
      return currentNum;
    },
  },

  Mutation: {
    incrementNumber(_, args) {
      pubsub.publish("NUMBER_INCREMENTED", { numberIncremented: args.num });
      return args.num;
    },
  },

  Subscription: {
    numberIncremented: {
      subscribe: () => pubsub.asyncIterator(["NUMBER_INCREMENTED"]),
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const ws = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

const serverCleanup = useServer({ schema }, ws);

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();

app.use(
  "/graphql",
  cors<cors.CorsRequest>(),
  express.json(),
  expressMiddleware(server)
);

const PORT = 4000;

httpServer.listen(PORT, () => {
  console.log("started service");
});
