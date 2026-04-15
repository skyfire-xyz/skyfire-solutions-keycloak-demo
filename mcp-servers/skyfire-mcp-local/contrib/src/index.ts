import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Hono } from "hono";
import { env } from "cloudflare:workers";
import twilio from "twilio";

type Bindings = Env;
const app = new Hono<{
  Bindings: Bindings;
}>();

type Props = {
  "skyfire-api-key": string;
  "skyfire-api-version": string;
};

type State = null;

const accountSid = env.TWILIO_ACCOUNT_SID;
const authToken = env.TWILIO_AUTH_TOKEN;
const smsReceiverNumber = env.SMS_RECEIVER_NUMBER;

export class MyMCP extends McpAgent<Bindings, State, Props> {
  server = new McpServer({
    name: "skyfire-identity-payment-v4",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  client = twilio(accountSid, authToken);

  async initiateAuth(text_input: string) {
    const initiate_sms = await this.client.messages.create({
      to: smsReceiverNumber,
      from: "+13656574741",
      body: text_input,
    });

    console.log(initiate_sms.status);
    return initiate_sms;
  }

  async init() {

    this.server.resource("guide", "mcp://guide", async (uri) => {
      return {
        contents: [{
          uri: uri.href,
          text: `This is Skyfire Identity and Payment MCP server, it has following tools 
  find-seller: find a seller for the requested data & retrieve the MCP server URL of the seller,
  create-kya-token: create a KYA(Know your agent) token,
  create-payment-token: create a PAY token for the transaction,
  
  The ideal flow would be to find a seller relevant to the user's query. As response of find-seller tool call the seller MCP server URL is returned which has more tools exposed seller MCP server. 
  Connect to the seller MCP server in order to gain access to all the tools. 
  KYA token is JWT token having information about the buyer agent. If there is a need to create account or login with seller, create the KYA token. 
  The purchase details can be finalized using the tools provided by seller for exploring the products and corresponding price. 
  Important: Only create the PAY token once the purchase details are finalized and amount is decided because creating PAY token deducts the amouont from actual wallet balance.
`
      }]
      };
    });

    this.server.tool(
      "find-seller",
      `Needs an input prompt to identify relevant sellers for. 
      This tool returns seller details(seller name, sellerServiceId and MCP server URL).
      MCP server URL is not same as dataset URL`,
      {input_prompt: z.string().describe("Input prompt from the buyer with details of the intended purchase")},
      async ({input_prompt}) => {
        if (input_prompt !== "") {
        const res = [
          {
            skyfire_receiver_username: "CarbonArc",
            seller_MCP_server_URL:
              "https://carbonarc-seller-v4.supermojo.workers.dev/sse",
            seller_service_ID: "042aa019-6e8f-4ede-92c2-de6b49292e8b",
            price: "1",
            price_scheme: "pay per use",
            minimum_token_amount: "0.0001",
            name: "CarbonArc",
            description: "Has datasets for pickup trucks",
            type: "automobile",
            API_spec_or_URL: "",
            required_verification_level: "",
            seller_user_verification_level: "",
          },
        ];

        return {
          content: [
            {
              type: "text",
              text: `Seller is ${res[0].skyfire_receiver_username} having sellerServiceId as ${res[0].seller_service_ID} and MCP server is hosted at ${res[0].seller_MCP_server_URL}`,
            },
          ],
        };
        }
        else {
          return {
            content: [
              {
                type: "text",
                text: "What can I help you with today?"
              }
            ]
          }
        }
      }
    );

    this.server.tool(
      "create-kya-token",
      `This tool generates and returns the KYA token (JWT).
      KYA stands for Know Your Agent. KYA token is in JWT format which has user details in the JWT payload.
      This token could be used to share agent information for creating new account or login to existing account or for any other usecase which needs agent information. 
      `,
      {
        buyerTag: z.string().uuid().describe("unique buyer agent identification (uuid)"),
        sellerServiceId: z.string().describe("ID of connected seller"),
      },
      async ({ buyerTag, sellerServiceId }) => {
        const response = await fetch("https://api-qa.skyfire.xyz/v2/tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "skyfire-api-key": this.props["skyfire-api-key"],
            "skyfire-api-version": "2",
          },
          body: JSON.stringify({
            type: "kya",
            buyerTag: buyerTag,
            sellerServiceId: sellerServiceId,
            expiresAt: 1843528592,
          }),
        });

        console.log("kyaPayload", JSON.stringify({
          type: "kya",
          buyerTag: buyerTag,
          sellerServiceId: sellerServiceId,
          expiresAt: 1843528592,
        }));

        const res: { token: string } = await response.json();


        console.log("generatedKYA",  res.token);

        return {
          content: [
            {
              type: "text",
              text: `Your KYA token (JWT) is created ${res.token}`, 
            },
          ],
        };
      }
    );

    this.server.tool(
      "create-payment-token",
      `This tool takes amount and sellerServiceId to create a PAY token (JWT) for a transaction. It returns generated PAY token (JWT).
      PAY token stands for payment token. Whenever PAY token is generated it actually deducts money from the linked wallet. 
      So, essentially PAY token should only be generated if intention is to execute a payment transaction.
      `,
      {
        amount: z.string().describe("dollar value of dataset selected for download"),
        sellerServiceId: z.string().describe("ID of connected seller"),
        buyerTag: z.string().uuid().describe("unique buyer agent identification (uuid)"),
      },
      async ({ amount, sellerServiceId, buyerTag }) => {
        const response = await fetch("https://api-qa.skyfire.xyz/v2/tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "skyfire-api-key": this.props["skyfire-api-key"],
            "skyfire-api-version": "2",
          },
          body: JSON.stringify({
            type: "pay",
            buyerTag: buyerTag,
            tokenAmount: amount,
            sellerServiceId: sellerServiceId, 
            expiresAt: 1843528592,
          }),
        });

        console.log("PAYpayload", JSON.stringify({
          type: "pay",
          buyerTag: buyerTag,
          tokenAmount: amount,
          sellerServiceId: sellerServiceId, 
          expiresAt: 1843528592,
        }));

        const res: { token: string } = await response.json();
        console.log("PAYRes", res);
        console.log("generatedPAYToken", res.token);

        if (!res) {
          return {
            content: [
              {
                type: "text",
                text: `Unable to create pay token`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Transaction of ${amount} is successful to ${sellerServiceId} via token ${res.token}`,
            },
          ],
        };
      }
    );
  }
}

// Render a basic homepage placeholder to make sure the app is up
app.get("/", async (c) => {
  return c.html("Home Page for Skyfire Identity and Payment MCP Server");
});

app.mount("/", (req, env, ctx) => {
  console.log("headers", req.headers);

  const skyfireApiKey = req.headers.get("skyfire-api-key");
  console.log("skyfireApiKey", skyfireApiKey)
  if (!skyfireApiKey) {
    return new Response("Skyfire API Key is required", { status: 400 });
  }

  ctx.props = {
    "skyfire-api-key": skyfireApiKey,
  };

  return MyMCP.mount("/sse").fetch(req, env, ctx);
});

export default app;
