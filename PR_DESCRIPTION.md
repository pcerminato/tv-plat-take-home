# PR Write-up

## Summary

### Pagination stategy

- _offset & limit_ (🟡): easy to implement: query params `?offset=20&limit=10` maps directly to the query `OFFSET 20 LIMIT 10` (aka. "skip 20, return the next 10"). Still the performance is downgrades as the offset grows, because the database scans the rows in the offset.
- _page & page-size_ (🟡): the query params input would be different, `?page=1&size=10`, but the limitations are the same as the above approach.
- _last-id_ (🟢): start a page after the last id of the last page. The query params would look like `?last=123&limit=10`. The query in the db is performant because it is based on the primary key (uses an existing index, no need to add a new one).

The choice of _last-id_ is entirely based on the performance of the query, but for a real use case, the choice should consider how the API would be used: for example, if a UI will do traditional "back and forth" pages navigation, _offset & limit_ could be a good choice. But for infinite scrolling or real-time and for consistency (ex. avoid skipping new data) _last-id_ would be ideal.

A consideration to bring up for the _last-id_ approach is that for the case of `/resources?last=1` (and `limit` is not set), when the dataset is large (say 1000), it'd return from `id=2`, to `id=1000`. So a constrait for the implementation is having `last` bound to `limit`: if `last` is set and limit is not, the code fallsback to a default value to prevent an unwanted large result. This case is covered in the unit test: `{ limit: undefined, last: 1, result: DEFAULT_LIMIT }`.

### Security

- Query params sanitizer. Added a custom middleware for query parameters validation at `middleware/input-sanitizer.ts`. The implementation relies on the `express-validator` package, but the approach to using it as middleware in the express app keeps it decoupled..
- XSS: is catch by express-validator when using `isInt()` and `.escape()`
- SQL injection. I am just relying on pg parametrized queries to prevent it. An alternative would be using an ORM.

### Indexes

Considering whether adding indexes for `type` and `status` will depend on:

- the amount of data to scan in the DB (if the data is small, postgres might plan not to use the index and use seq scan).
- the frequency the `type` and `status` params are used in the endpoint and how are they combined.

Anyway, as `resources` is the main entity of the domain, I assume that the amount of data in it will grow as much as an index would be fundamental.

Then mking the right choice on how to build the index will depend on the usage of `type` and `status`.

Below come some assumptions.

They could be used in a query _combined_ or _individually_.

_Combined_ 🟡

If combined is the use case, then a composite index would be a good choice. From there, the question that follows is what is the main column for the index? If either of the columns (ex. `status`) can be ensured to be the main, for example queries,
`WHERE status = 'published' AND type = 'sheet'` or `WHERE status = 'published'`, the a coposite index status->type will suit perfectly.
`CREATE INDEX idx_resources_status_type ON resources (status, type);`

On the other hand, such index wouldn't work for queries filtered by just `WHERE type = 'sheet'`

_individually (or combined)_ 🟢

For this use case, two separate indexes on status and type would work out better, because it would provide more flexibility as postgres would combine them or use them individually.

```
CREATE INDEX idx_resources_type ON resources (type);
CRETE INDEX idx_resources_status ON resources (status);
```

For either choice, it would also make sense to include the `id` as part of the index as it is used as a filter for pagination.

## Changes

- Adding a middleware/input-sanitizer.ts defining operations to validate the inputs given in query string (limit, last).
  - Invalid inputs would result on a "invalid value" response of the endpoint .
- Adding pagination based on the _last-id_ strategy (explained above).
- Adding filtering by `status` and `type`.
- Including unit test cases to cover pagination edge cases and error expected.
- Changing `findResources()` to implement pagination.
  - Changes in `findResources()` are compatible with the previous behaviour of returning the full dataset.
- Adding an error handler as a middleware to processed uncatched errors.

## Testing

### Test cases for `/resources`

- **Automated tests:**
  - Test suites to validate the expected behaviour on edge cases and for errors.
  - A test suite to validate the consistency of the result of the combinations of the filters by `status` and `type`, along with the pagination parameters.
- **Edge cases:**
  - bad inputs (ex. strings that don't represent numbers).
  - requesting data out of the `limit`
  - fallback to the default behaviour when no input is set.
- **Performance / regression:**
  - Performance regresions are not expected for the pagination, because it relies on the `id`, which is an indexed value.
  - With pagination this, the performance is improved. Still, to measure it properly, it'd be necessary to have a larger dataset, because with the 30 records that the sample has, posgres still uses a sequential a scan. For example:

  `EXPLAIN ANALYSE SELECT id, owner_id, type, status, title, created_at, updated_at FROM resources WHERE id > 10;`

  ```
  Seq Scan on resources  (cost=0.00..22.38 rows=683 width=54) (actual time=0.085..0.090 rows=20 loops=1)
   Filter: (id > 10)
   Rows Removed by Filter: 10
    Planning Time: 0.418 ms
    Execution Time: 0.196 ms
    (5 rows)
  ```

- **How verified:**
  - Running the regular test suite: `npm run test`.

## Trade-offs

(See "pagination strategy", "security" and "indexes" titles above.)

## Open questions

- As mentioned in the "pagination strategy", it'd make sense to verify in which way is the pagination intended to be used, so the choice for the strategy can be thoughtfully made.
- I kept the endpoint `/resources` compatible to working the way it was given, meaning it returns the whole set of 30 records if it hasn't the `limit` and `last` params set. But that would not be recomended for prod, because if the dataset grows to thouzands of records, is a damage to performance.
