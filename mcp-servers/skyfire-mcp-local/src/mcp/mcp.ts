/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable-next-line import/no-extraneous-dependencies */
import { z } from 'zod' // NOTE: this MUST be the same version of zod as mcp server sdk's zod dependency, or there may be a typescript error
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  getSellerResourceDataContent,
  createKYAPAYToken,
  createKYAToken,
  createPAYToken
  // IDENTITY_PERMISSIONS
} from './tools/tools'

export class SkyfireMCP {
  readonly server = new McpServer({
    name: 'skyfire-mcp-server-v1',
    version: '0.0.1',
    capabilities: {
      resources: {},
      tools: {}
    }
  })

  constructor(private readonly apiKey: string) {
    this.init()
  }

  init(): void {
    this.server.resource('guide', 'mcp://guide', async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            text: `This is Skyfire Identity and Payment MCP server, it has following tools 
  find-seller: find a seller for the requested data & retrieve the MCP server URL of the seller,
  create-kya-token: create a KYA(Know your agent) token to create accounts,
  create-payment-token: create a PAY token for the transaction,
  create-kya-payment-token: create a KYAPay token for guest transaction,
  get-current-datetime: get the current date and time in various formats,
  
  The ideal flow would be to find a seller relevant to the user's query. You can do that via the seller services resources file or the find-seller tool that identifies other MCP servers in the skyfire ecosystem that offer additional tools and may be relevant to the user's query. 
  Connect to the seller MCP server in order to gain access to all the tools. 
  KYA token is JWT token having information about the buyer agent. If there is a need to create account or login with seller, create the KYA token. 
  To purchase servers with the seller after having created an account, use a PAY token.
  The purchase details can be finalized using the tools provided by seller for exploring the products and corresponding price. 
  Important: Only create the PAY token once the purchase details are finalized and amount is decided because creating PAY token deducts the amount from actual wallet balance. 
  KYAPay tokens can be used to purchase seller services at the same time as creating an account, or in order to pay without having to first make an account (eg guest checkout). It combines aspects of KYA and PAY tokens together.
  To complete a payment transaction using a PAY or KYAPay token, the token must be delivered to the seller service in a request. Simply creating the payment token is not sufficient to complete the transaction; it must be delivered to the seller service for validation and charging. 
  `
          }
        ]
      }
    })

    // remove this so that agents show they are calling the find-sellers tool, so demo agents switching to official servers will work as well
    // this.server.resource(
    //   'seller-services',
    //   'mcp://seller-services',
    //   async (uri) => {
    //     const sellerServicesData = await getSellerResourceDataContent()
    //     return {
    //       contents: [
    //         {
    //           uri: uri.href,
    //           text: sellerServicesData,
    //           mimeType: 'application/json'
    //         }
    //       ]
    //     }
    //   }
    // )

    // this.server.tool(
    //   'find-sellers',
    //   'get resource data about sellers on the skyfire network',
    //   {
    //     search: z.string().describe(
    //       `Concise description of the type of services you want to connect to. 
    //         example search: weather api`
    //     )
    //   },
    //   async (params: { search: string }): Promise<any> => {
    //     // search parameter is required by MCP client but not currently used
    //     const _search = params.search
    //     return {
    //       content: [
    //         {
    //           type: 'text',
    //           text: await getSellerResourceDataContent()
    //         }
    //       ]
    //     }
    //   }
    // )

       this.server.tool(
      'find-sellers',
      'get resource data about sellers on the skyfire network',
      {
        search: z.string().describe(
          `Concise description of the type of services you want to connect to. 
            example search: weather api`
        )
      },
      async (params: { search: string }): Promise<any> => {
        // search parameter is required by MCP client but not currently used
        const _search = params.search
        return {
          content: [
            {
              type: 'text',
              text: await getSellerResourceDataContent()
            }
          ]
        }
      }
    )

    this.server.tool(
      'create-kya-token',
      `This tool generates and returns the KYA token (JWT).
          KYA stands for Know Your Agent. KYA token is in JWT format which has user details in the JWT payload.
          This token could be used to share agent information for creating new account or login to existing account or for any other usecase which needs agent information.
          `,
      {
        sellerServiceId: z.string().describe('ID of connected seller')
        // TODO: commented out because Openai needs required fields or nullable -- so the less number of optional/nullable fields the better.
        // buyerTag: z
        //   .string()
        //   .nullable()
        //   .describe('unique buyer agent identification')
        // Once structured outputs for BOTH Openai and Anthropic are implemented to accept nullable/optional, we can uncomment these fields.
        // expiresAt: z
        //   .number()
        //   .nullable()
        //   .describe(
        //     'Seconds since the Unix epoch. Default: 24 hours in the future. ' +
        //       'Between 10 seconds and 24 hours (86,400 seconds) in the future.'
        //   ),
        // identityPermissions: z
        //   .array(z.enum(IDENTITY_PERMISSIONS))
        //   .default([])
        //   .describe(
        //     'Additional identity fields to include in the token. ' +
        //       'Must be valid verification field names. Default: empty array.'
        //   )
      },
      async (params: {
        sellerServiceId: string
        // buyerTag: string | null
        // expiresAt: number | null
        // identityPermissions: string[] | null
      }): Promise<any> => {
        return await createKYAToken(params, this.apiKey)
      }
    )

    this.server.tool(
      'create-pay-token',
      `This tool takes amount and sellerServiceId to create a PAY token (JWT) for a transaction. It returns generated PAY token (JWT).
          PAY token stands for payment token. Whenever PAY token is generated it actually deducts money from the linked wallet.
          So, essentially PAY token should only be generated if intention is to execute a payment transaction.
          `,
      {
        amount: z.string().describe('dollar value of the token'),
        sellerServiceId: z.string().describe('ID of connected seller')
        // TODO: commented out because Openai needs required fields or nullable -- so the less number of optional/nullable fields the better.
        // buyerTag: z
        //   .string()
        //   .nullable()
        //   .describe('unique buyer agent identification')
        // expiresAt: z
        //   .number()
        //   .nullable()
        //   .describe(
        //     'Seconds since the Unix epoch. Default: 24 hours in the future. ' +
        //       'Be between 10 seconds and 24 hours (86,400 s) in the future'
        //   )
      },
      async (params: {
        amount: string
        sellerServiceId: string
        // buyerTag: string | null
        // expiresAt: number | null
      }): Promise<any> => {
        return await createPAYToken(params, this.apiKey)
      }
    )

    this.server.tool(
      'create-kya-payment-token',
      `This tool takes amount and sellerServiceId to create a KYAPay token (JWT) for a transaction. It returns generated KYAPay token (JWT).
          KYAPay token stands for know-your-agent and payment token. Whenever KYAPay token is generated it actually deducts money from the linked wallet and can be used to create an account while paying.
          `,
      {
        amount: z.string().describe('dollar value of the token'),
        sellerServiceId: z.string().describe('ID of connected seller')
        // TODO: commented out because Openai needs required fields or nullable -- so the less number of optional/nullable fields the better.
        // buyerTag: z
        //   .string()
        //   .nullable()
        //   .describe('unique buyer agent identification')
        // expiresAt: z
        //   .number()
        //   .nullable()
        //   .describe(
        //     'Seconds since the Unix epoch. Default: 24 hours in the future. ' +
        //       'Between 10 seconds and 24 hours (86,400 seconds) in the future.'
        //   ),
        // identityPermissions: z
        //   .array(z.enum(IDENTITY_PERMISSIONS))
        //   .default([])
        //   .describe(
        //     'Additional identity fields to include in the token. ' +
        //       'Must be valid verification field names. Default: empty array.'
        //   )
      },
      async (params: {
        amount: string
        sellerServiceId: string
        // buyerTag: string | null
        // expiresAt: number | null
        // identityPermissions: string[] | null
      }): Promise<any> => {
        return await createKYAPAYToken(params, this.apiKey)
      }
    )

    this.server.tool(
      'get-current-datetime',
      'Get the current date and time in various formats like Unix timestamp, ' +
        'ISO string, and human-readable format.',
      {
        format: z
          .enum(['unix', 'iso', 'readable', 'all'])
          .nullable()
          .describe(
            'Format of the datetime to return. Options: unix timestamp, ' +
              'iso (ISO 8601 string), readable (human-readable format), ' +
              'all (returns all formats). Default: all.'
          )
      },
      async (params: {
        format: 'unix' | 'iso' | 'readable' | 'all' | null
      }): Promise<any> => {
        const now = new Date()
        const format = params.format ?? 'all'

        const result: any = {}

        if (format === 'all' || format === 'unix') {
          result.unix = Math.floor(now.getTime() / 1000)
        }

        if (format === 'all' || format === 'iso') {
          result.iso = now.toISOString()
        }

        if (format === 'all' || format === 'readable') {
          result.readable = now.toLocaleString()
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      }
    )
  }
}
