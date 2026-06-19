type BuildResourcesUriParams = {
  limit?: number | string;
  last?: number | string;
  status?: string;
  type?: string;
};

/* Helper function to build the url for the unit tests based on the query parameters */
export function buildResourcesUri({
  limit,
  last,
  status,
  type,
}: BuildResourcesUriParams) {
  let uri = `/resources?`;
  if (limit) {
    uri += `limit=${limit}`;
  }
  if (last) {
    uri += `&last=${last}`;
  }
  if (status) {
    uri += `&status=${status}`;
  }
  if (type) {
    uri += `&type=${type}`;
  }
  return uri;
}
