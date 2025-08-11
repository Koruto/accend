export const typeDefs = `
  enum UserRole { developer qa admin }
  enum ResourceType {
    deployment_env_lock
    test_run_request
  }
  enum RequestStatus { pending approved denied expired }
  enum RiskLevel { low medium high }

  enum BookingStatus { pending approved active finished expired released denied }

  type User { id: ID! name: String! email: String! role: UserRole! accessLevel: Int! }

  type Resource {
    id: ID!
    name: String!
    type: ResourceType!
    riskLevel: RiskLevel!
    approverRole: UserRole!
    tags: [String!]!
    allowedRequesterRoles: [UserRole!]!
  }

  type Request {
    id: ID!
    userId: ID!
    resourceId: ID!
    resourceType: ResourceType!
    status: RequestStatus!
    justification: String!
    createdAt: String!
    durationHours: Int
    approvedAt: String
    expiresAt: String
    approverId: ID
    approverName: String
    decisionNote: String
  }

  type Environment {
    id: ID!
    name: String!
    isFreeNow: Boolean!
    freeAt: String
    accessLevelRequired: Int
  }

  type Booking {
    id: ID!
    envId: ID!
    userId: ID!
    status: BookingStatus!
    createdAt: String!
    justification: String!
    startedAt: String
    endsAt: String
    releasedAt: String
    closedReason: String
    durationMinutes: Int!
    extensionMinutesTotal: Int
  }

  input SignupInput { name: String!, email: String!, password: String!, role: UserRole! }
  input LoginInput { email: String!, password: String! }

  type AuthPayload { user: User! }

  input RequestFilter {
    statuses: [RequestStatus!]
    resourceIds: [ID!]
    resourceTypes: [ResourceType!]
    start: String
    end: String
    q: String
  }

  input CreateRequestInput { resourceId: ID!, justification: String!, durationHours: Int }

  input DecideRequestInput { requestId: ID!, approve: Boolean!, decisionNote: String }
  type RequestWithUser {
    request: Request!
    requesterName: String!
    requesterEmail: String!
  }

     type Query {
     viewer: User
     resources: [Resource!]!
     myRequests(filter: RequestFilter): [Request!]!
 
     environments: [Environment!]!
     activeBookingMe: Booking
     bookingsMe: [Booking!]!
     bookingsAll: [Booking!]!
     adminAllRequests: [RequestWithUser!]!
 
     branchRefs(projectKey: String): [String!]!
 
     adminPendingRequests: [RequestWithUser!]!
   }

  type Mutation {
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    logout: Boolean!
    createRequest(input: CreateRequestInput!): Request!
 
    decideRequest(input: DecideRequestInput!): Request!
 
     createEnvironmentBooking(envId: ID!, durationMinutes: Int!, justification: String!): Booking!
     extendEnvironmentBooking(bookingId: ID!, addMinutes: Int!): Booking!
     releaseEnvironmentBooking(bookingId: ID!): Booking!

    updateMeName(name: String!): User!
  }
`;

export default typeDefs; 