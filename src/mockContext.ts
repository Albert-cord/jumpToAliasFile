export let mockRollupPluginContextResolve = {resolve: function(updatedId, importer, otherConfig) {
  return new Promise((res, rej) => {
    // console.log(`updatedId`, updatedId)
    res(updatedId);
  })
}}
