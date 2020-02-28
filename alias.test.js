// import { platform } from 'os';

// import slash from 'slash';
const slash = require('slash');
const path = require('path');

const { posix } = path;


const {platform} = require('os')

const VOLUME = /^([A-Z]:)/i;
const IS_WINDOWS = platform() === 'win32';
const normalizePath = (pathToNormalize) => slash(pathToNormalize.replace(/^([A-Z]:)/, ''));
const DIRNAME = normalizePath(__dirname);

// Helper functions
const noop = () => null;
const matches = (pattern, importee) => {
  if (pattern instanceof RegExp) {
    return pattern.test(importee);
  }
  if (importee.length < pattern.length) {
    return false;
  }
  if (importee === pattern) {
    return true;
  }
  const importeeStartsWithKey = importee.indexOf(pattern) === 0;
  const importeeHasSlashAfterKey = importee.substring(pattern.length)[0] === '/';
  return importeeStartsWithKey && importeeHasSlashAfterKey;
};

const normalizeId = (id) => {
  if ((IS_WINDOWS && typeof id === 'string') || VOLUME.test(id)) {
    return slash(id.replace(VOLUME, ''));
  }
  return id;
};

const getEntries = ({ entries }) => {
  if (!entries) {
    return [];
  }

  if (Array.isArray(entries)) {
    return entries;
  }

  return Object.keys(entries).map((key) => {
    return { find: key, replacement: entries[key] };
  });
};

function alias(options = {}) {
  const entries = getEntries(options);

  // No aliases?
  if (entries.length === 0) {
    return {
      resolveId: noop
    };
  }

  return {
    name: 'alias',
    resolveId(importee, importer) {
      const importeeId = normalizeId(importee);
      const importerId = normalizeId(importer);

      // First match is supposed to be the correct one
      const matchedEntry = entries.find((entry) => matches(entry.find, importeeId));
      if (!matchedEntry || !importerId) {
        return null;
      }

      const updatedId = normalizeId(
        importeeId.replace(matchedEntry.find, matchedEntry.replacement)
      );

      let customResolver = null;
      if (typeof matchedEntry.customResolver === 'function') {
        ({ customResolver } = matchedEntry);
      } else if (
        typeof matchedEntry.customResolver === 'object' &&
        typeof matchedEntry.customResolver.resolveId === 'function'
      ) {
        customResolver = matchedEntry.customResolver.resolveId;
      } else if (typeof options.customResolver === 'function') {
        ({ customResolver } = options);
      } else if (
        typeof options.customResolver === 'object' &&
        typeof options.customResolver.resolveId === 'function'
      ) {
        customResolver = options.customResolver.resolveId;
      }

      if (customResolver) {
        return customResolver(updatedId, importerId);
      }

      return this.resolve(updatedId, importer, { skipSelf: true }).then((resolved) => {
        let finalResult = resolved;
        // console.log(`finalResult`, finalResult)

        if (!finalResult) {
          finalResult = { id: updatedId };
        }

        return finalResult;
      });
    }
  };
}

// let {resolveId} = alias(    {
//   entries: [
//     { find: 'foo', replacement: 'bar' },
//     { find: 'pony', replacement: 'paradise' },
//     { find: './local', replacement: 'global' }
//   ]
// });
let mockPluginContextResolve = {resolve: function(updatedId, importer, otherConfig) {
  return new Promise((res, rej) => {
    // console.log(`updatedId`, updatedId)
    res(updatedId);
  })
}}

// resolveId = resolveId.bind(mockPluginContextResolve);
// ;console.log(`resolveId('foo')`, resolveId('foo/testdir/anyfile', '/src/importer.js'));

let printAliasParam = function(aliasParam) {
  try {
    return JSON.stringify(aliasParam)
  } catch (error) {
    if ('toString' in aliasParam && typeof aliasParam.toString === 'function') {
      return aliasParam.toString();
    } else {
      return aliasParam;
    }
  }
}

let count = 0;
let Count = 0;

let resolveAliasWithRollupAliasPlugin = async function(aliasOptions, testAliasParams, expectResult) {
  let {resolveId} = alias(aliasOptions)
  resolveId = resolveId.bind(mockPluginContextResolve);
  if(Array.isArray(expectResult)) {
    testAliasParams.forEach(async (aliasParam, index) => {
      let {source, importer} = aliasParam;
      let ret = await resolveId(source, importer);
      if ( ret !== expectResult[index]) {
        console.log(`No.${++Count} test: wrong!!!, aliasParams: ${printAliasParam(aliasParam)}, result: ${ret}, but expectResult: ${expectResult[index]}`);
      } else {
        console.log(`No.${++Count} test: right, aliasParams: ${printAliasParam(aliasParam)}, result: ${ret}, expectResult: ${expectResult[index]}`);
      }
    })
  } else {
    let {source, importer} = testAliasParams;
    let ret = await resolveId(source, importer);
    if (ret !== expectResult[index]) {
      console.log(`No.${++Count} test: wrong!!!, aliasParams: ${printAliasParam(testAliasParams)}, result: ${ret}, but expectResult: ${expectResult[index]}`);
    } else {
      console.log(`No.${++Count} test: right, aliasParams: ${printAliasParam(testAliasParams)}, result: ${ret}, expectResult: ${expectResult[index]}`);
    }
  }
  
}
// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       { find: 'foo1', replacement: 'bar' },
//       { find: 'pony', replacement: 'paradise' },
//       { find: './local', replacement: 'global' }
//     ]
//   },
//   [
//     { source: 'foo1', importer: '/src/importer.js' },
//     { source: 'pony', importer: '/src/importer.js' },
//     { source: './local', importer: '/src/importer.js' }
//   ], 
//   ['bar', 'paradise', 'global']
// );


// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: {
//       foo2: 'bar',
//       pony2: 'paradise',
//       './local2': 'global'
//     }
//   },
//   [
//     { source: 'foo2', importer: '/src/importer.js' },
//     { source: 'pony2', importer: '/src/importer.js' },
//     { source: './local2', importer: '/src/importer.js' }
//   ], 
//   ['bar', 'paradise', 'global']
// );



// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       { find: /f(o+)bar/, replacement: 'f$1bar2019' },
//       { find: new RegExp('.*pony.*'), replacement: 'i/am/a/barbie/girl' },
//       { find: /^test\/$/, replacement: 'this/is/strict' }
//     ]
//   },
//   [
//     { source: 'fooooooooobar', importer: '/src/importer.js' },
//     { source: 'im/a/little/pony/yes', importer: '/src/importer.js' },
//     { source: './test', importer: '/src/importer.js' },
//     { source: 'test', importer: '/src/importer.js' },
//     { source: 'test/', importer: '/src/importer.js' }
//   ], 
//   ['fooooooooobar2019', 'i/am/a/barbie/girl', null, null, 'this/is/strict']
// );



// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       { find: 'fo3o', replacement: 'bar' },
//       { find: './foo', replacement: 'bar' }
//     ]
//   },
//   [
//     { source: 'fo3o2', importer: '/src/importer.js' },
//     { source: './fooze/bar', importer: '/src/importer.js' },
//     { source: './someFile.foo', importer: '/src/importer.js' }
//   ], 
//   [null, null, null]
// );



// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [{ find: 'abacaxi', replacement: './abacaxi' }]
//   },
//   [{ source: 'abacaxi/entry.js' }], 
//   [null]
// );



// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [{ find: 'resolve', replacement: 'i/am/a/file' }]
//   },
//   [{ source: 'resolve', importer: '/src/import.js' }], 
//   ['i/am/a/file']
// );



// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       {
//         find: 'resolve1',
//         replacement: 'E:\\react\\node_modules\\fbjs\\lib\\warning'
//       }
//     ]
//   },
//   [{ source: 'resolve1', importer: posix.resolve(DIRNAME, './fixtures/index.js') }], 
//   [normalizePath('E:\\react\\node_modules\\fbjs\\lib\\warning')]
// );



// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       {
//         find: 'resolve2',
//         replacement: 'E:\\react\\node_modules\\fbjs\\lib\\warning'
//       }
//     ]
//   },
//   [{ source: 'resolve2', importer: posix.resolve(DIRNAME, './fixtures/index.js') }], 
//   [normalizePath('E:\\react\\node_modules\\fbjs\\lib\\warning')]
// );


/** */
// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       { find: 'fancyNumber', replacement: './aliasMe' },
//       { find: './anotherFancyNumber', replacement: './localAliasMe' },
//       { find: 'numberFolder', replacement: './folder' },
//       { find: './numberFolder', replacement: './folder' }
//     ]
//   },
//   [{ source: 'resolve', importer: posix.resolve(DIRNAME, './fixtures/index.js') }], 
//   [normalizePath('E:\\react\\node_modules\\fbjs\\lib\\warning')]
// );

// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       {
//         find: 'test',
//         replacement: path.resolve('./test/files/folder/hipster.jsx')
//       }
//     ],
//     customResolver: () => 'customResult'
//   },
//   [{ source: 'test', importer: posix.resolve(DIRNAME, './files/index.js') }],
//   ['customResult']
// );


// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       {
//         find: 'test2',
//         replacement: path.resolve('./test/files/folder/hipster.jsx'),
//         customResolver: () => 'localCustomResult'
//       }
//     ],
//     customResolver: () => 'customResult'
//   },
//   [{ source: 'test2', importer: posix.resolve(DIRNAME, './files/index.js') }],
//   ['localCustomResult']
// );


// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       {
//         find: 'test3',
//         replacement: path.resolve('./test/files/folder/hipster.jsx')
//       }
//     ],
//     customResolver: { resolveId: () => 'customResult' }
//   },
//   [{ source: 'test3', importer: posix.resolve(DIRNAME, './files/index.js') }],
//   ['customResult']
// );


// resolveAliasWithRollupAliasPlugin(
//   {
//     entries: [
//       {
//         find: 'test4',
//         replacement: path.resolve('./test/files/folder/hipster.jsx'),
//         customResolver: { resolveId: () => 'localCustomResult' }
//       }
//     ],
//     customResolver: { resolveId: () => 'customResult' }
//   },
//   [{ source: 'test4', importer: posix.resolve(DIRNAME, './files/index.js') }],
//   ['localCustomResult']
// )