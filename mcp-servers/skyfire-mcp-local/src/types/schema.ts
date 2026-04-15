// these are from Dashboard, we can make this common in Skyfire SDK

export const ServiceType = {
  API: 'API',
  WEB_PAGE: 'WEB_PAGE',
  MCP_SERVER_LOCAL: 'MCP_SERVER_LOCAL',
  MCP_SERVER_REMOTE: 'MCP_SERVER_REMOTE',
  FETCH_AGENT: 'FETCH_AGENT'
} as const

export type ServiceTypeEnum = (typeof ServiceType)[keyof typeof ServiceType]

export const PriceModel = {
  PAY_PER_USE: 'PAY_PER_USE',
  PAY_PER_MB: 'PAY_PER_MB',
  CUSTOM: 'CUSTOM'
} as const

export type PriceModelEnum = (typeof PriceModel)[keyof typeof PriceModel]

export type IdentityLevel =
  | 'INDIVIDUAL_LEVEL1'
  | 'INDIVIDUAL_LEVEL2'
  | 'BUSINESS_LEVEL1'

export interface TOS {
  id: string
  active: boolean
  sellerServiceId: string
  createdDate: string
  updatedDate: string
  url: string
  required: boolean
}

export interface DirectoryService {
  id: string
  name: string
  description: string
  tags: string[]
  type: ServiceTypeEnum
  price: string
  priceModel: PriceModelEnum
  minimumTokenAmount: string
  buyerIdentityRequirement: {
    identityLevels: IdentityLevel[]
    business: string[]
    individual: string[]
  }
  seller: {
    id?: string
    name: string
    identityLevel: IdentityLevel
  }
  createdAt: string
  updatedAt: string
  websiteUrl: string
  fetchAgentProfileUrl: string
  openApiSpecUrl: string
  mcpServerUrl: string
  termsOfService: TOS
}
