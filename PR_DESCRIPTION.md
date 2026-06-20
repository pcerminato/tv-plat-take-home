# PR Write-up

## Summary

_One or two sentences: what this PR does and why._

## Changes

_Bullet the meaningful changes (endpoints, the shared data path, schema/index
changes, validation, etc.). Skip boilerplate._

- Authentication:
  - Adds a custom header `x-user-role` in the `authStub` middleware (note this is to emulate user role authentication, but this is not a production ready feature).
  - Adds a `authorizeAdmin` middleware in _middleware/authorize-admin.ts_ to read role from the req header and disallow access if the user is not an admin.
  - using `authorizeAdmin` to enable admin access only to `GET /users/:userId/resources`.
- Access control
  - /resources:
    - it returns all resources owned by the authenticated users
    - for `role=admin` the result also includes the resources shared with the user.
  - /resources/recent: applies the same as for `/resources` but keeping the original filters logic (limit and sort)
  - /users/:userId/resources
    - `role=member` users are prevented to use this endpoint.
    - `role=admin` can see other users resources (it works as impersonation).
- Refactoring the shared data path for access control.
  - Adding the role as a mandatory input to `findResources()`.
  - Implementing the query builder logic based on the role.
    - Splitting the flow control for role=admin and for role=member to reflect the use case of data visibility for each.

## Testing

The tests for all admin cases are not exaustive, but cover the most important cases.

_The most important section._

- **Automated tests:** what you added and what they cover.
  - Refactored the tests introduced for the Task #1 to comply with the role contraints.
  - Added an `test/endpoints.test.ts` with suites to cover authentication and access control. It is not exaustive, but covers the main features:
    - `/user/:ownerId/resources`
      - Access to the endpoint only for role=admin; access denied for rele=member.
      - Access denied if authorization headers are missing
    - `/resources`
      - Test that the visibility of the resources returned for a role=member are as owner (no shared data).
- **Edge cases:** (described above)
- **Performance / regression:**
  - Refactored the tests introduced for the Task #1 to comply with the role contraints.
  - (see mentions in _Query investigation_ title)
- **How verified:** Running the regular test suite: `npm run test`.

## Trade-offs

- _Using real authentication_. For accessing the user role, I used the same approach that was for the user in `/middleware/auth.ts`, which is hardcoding the role in the headers. In production code, I would have built a `/login` endpoint to get the user's role from the `users` table. Then I would have used JWT to expose the user and the role ([this is an example how](https://github.com/pcerminato/keywords-server/blob/main/src/middleware/authenticationHandler.ts)).

## Open questions

_Anything you'd raise with the team or that needs a product decision._

- An assumption I made is that `/users/:userId/resources` works as an _impersonation_ endpoint that admin users can use to see the resources of other users just as the owner user would see them. I would verify this assumption with product.

<hr />

# PS

## Query investigation

As a starting point for a query to get all resources for an owner plus the resources shared I came up with it:

```
SELECT id, type, status, title, owner_id, user_id, created_at, updated_at
FROM resources r LEFT JOIN resource_shares rs ON r.id = rs.resource_id
WHERE  owner_id = 2 OR rs.user_id=2
```

Its performance looks good for the small dataset, but it will be a bad idea for larger datasets. The issue is that filtering a cross table result with `OR` forces postgres to do a complicated strategy; different sequential scans and then combining the results, unable to filter before joining.

```
 Hash Right Join  (cost=1.68..35.05 rows=1036 width=62) (actual time=1.399..1.409 rows=9 loops=1)
   Hash Cond: (rs.resource_id = r.id)
   Filter: ((r.owner_id = 2) OR (rs.user_id = 2))
   Rows Removed by Filter: 21
   ->  Seq Scan on resource_shares rs  (cost=0.00..28.50 rows=1850 width=16) (actual time=0.312..0.313 rows=5 loops=1)
   ->  Hash  (cost=1.30..1.30 rows=30 width=54) (actual time=0.481..0.481 rows=30 loops=1)
         Buckets: 1024  Batches: 1  Memory Usage: 11kB
         ->  Seq Scan on resources r  (cost=0.00..1.30 rows=30 width=54) (actual time=0.039..0.046 rows=30 loops=1)
 Planning Time: 3.592 ms
 Execution Time: 2.142 ms
(10 rows)
```

Indexes might help, but still the with the fact that using `OR` makes postgres filtering after joining making it have a large dataset in memory to work with.

```
CREATE INDEX idx_resources_owner_id ON resources(owner_id);
CREATE INDEX idx_resource_shares_resource_id ON resource_shares (resource_id);
```

From that, it worths investigating a solution.

Q&A iterations with Gemini suggested an approach that uses:

- one select to query the resources own by the user,
- other for the resources shared with the user,
- then using UNION to combine the results.

> I thought of something similar to this at the begining, because it allows you to split the queries and have direct management over the different datasets for owned and shared resources. But what I didn' like was having two separate queries. Also I didn't think of considering `UNION` because it might make the query too large.

A query with union would look like this:

```
-- resources owned by the user
SELECT r.id, r.type, r.status, r.title, r.owner_id, rs.user_id, r.created_at, r.updated_at
FROM resources r
LEFT JOIN resource_shares rs ON r.id = rs.resource_id
WHERE r.owner_id = 2

UNION

-- resources shared with the user
SELECT r.id, r.type, r.status, r.title, r.owner_id, rs.user_id, r.created_at, r.updated_at
FROM resources r
INNER JOIN resource_shares rs ON r.id = rs.resource_id
WHERE rs.user_id = 2;
```

What makes this approach convincing is:

- Creating the necessary indexes is straight forward and clear:
  - Appart from those named above, one more combined index for the `JOIN` to allow jumping straight to the user_id, and its matching resources: `INDEX idx_resource_shares_user_resource ON resource_shares (user_id, resource_id);`
- Having two different SELECTS is friendlier for the planner to use indexes.
- What shines in this query is that it can filter before merging, which results on a smaller set of data to manage.
- As an effect of using the queries like this, the code of `findResources()` can be refactored to clearly separate the queries for admin role (with JOIN and UNION) from the one for member role, which is just the single initial query. This also covers backward compatibility.
