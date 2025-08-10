export const typeDefs = `
  enum UserRole { developer qa admin }
  enum ResourceType {
    deployment_env_lock
    feature_flag_change
    db_readonly
    dwh_dataset_viewer
    cloud_console_role
    object_store_write_window
    k8s_namespace_access
    secrets_read
    github_repo_permission
    cicd_bypass
    monitoring_edit
    logging_query
    test_run_request
    staging_build_request
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
    bufferMinutes: Int!
    isFreeNow: Boolean!
    freeAt: String
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

  type MetricsMe {
    activeAccesses: Int!
    pending: Int!
    expiring7d: Int!
    activeDeploymentLocks: Int!
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

     type Query {
     viewer: User
     resources: [Resource!]!
     myRequests(filter: RequestFilter): [Request!]!
     metricsMe: MetricsMe!
 
     environments: [Environment!]!
     activeBookingMe: Booking
     bookingsMe: [Booking!]!
 
     branchRefs(projectKey: String): [String!]!
   }

  type Mutation {
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    logout: Boolean!
    createRequest(input: CreateRequestInput!): Request!

    createEnvironmentBooking(envId: ID!, durationMinutes: Int!, justification: String!): Booking!
    extendEnvironmentBooking(bookingId: ID!, addMinutes: Int!): Booking!
    releaseEnvironmentBooking(bookingId: ID!): Booking!
  }
`;

export default typeDefs; 