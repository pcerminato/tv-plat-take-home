/* Helper function to build the url for the unit tests based on the query parameters */
export function buildResourcesUri(
  limit?: number | string,
  last?: number | string,
) {
  let uri = `/resources?`;
  if (limit) {
    uri += `limit=${limit}`;
  }
  if (last) {
    uri += `&last=${last}`;
  }
  return uri;
}
