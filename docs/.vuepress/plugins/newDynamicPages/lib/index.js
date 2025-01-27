const { createPage } = require('@vuepress/core')
const { path, fs } = require('@vuepress/utils')

const iosList = require('../../../json/ios');
const deviceList = require('../../../json/deviceList');
const deviceGroups = require('../../../json/deviceGroups');
const jbList = require('../../../json/jailbreak');
const bigJson = {
  ios: iosList,
  jailbreak: jbList,
  device: deviceList,
  groups: deviceGroups.sort(function(a,b) {
    const c = [a, b].map(x => JSON.stringify(x)).map(x => JSON.parse(x)) // don't ask

    if (c[0].subtype) c[0].type = [c[0].type,c[0].subtype].join('')
    if (c[1].subtype) c[1].type = [c[1].type,c[1].subtype].join('')

    if (c[0].type < c[1].type) return -1
    if (c[0].type > c[1].type) return 1
    
    if (c[0].order > c[1].order) return -1
    if (c[0].order < c[1].order) return 1

    return 0
  })
}

var bigObj = {}
for (const f of iosList) {
  const b = f.build
  const devArr = ((f.devices) ? Object.keys(f.devices) : [])
  bigObj[b] = {}
  for (const d of devArr) {
    bigObj[b][d] = []
    var jbStringArr = []
    for (const jb of jbList) {
      if (!jb.hasOwnProperty('compatibility')) continue
      for (const c of jb.compatibility) {
        if (!c.firmwares.includes(b)) continue
        if (!c.devices.includes(d)) continue

        const jbString = JSON.stringify(jb)
        if (jbStringArr.includes(jbString)) continue
        jbStringArr.push(jbString)

        bigObj[b][d].push(jb)
      }
    }
  }
}

var jbPath = '/jailbreak/'
var devicePath = '/device'

var pageList = []

for (const i of iosList) {
  const url = '/' + [i.osStr.replace(/ /g, '-'),i.uniqueBuild].join('/') + '.html'
  pageList.push({
    path: url,
    frontmatter: {
      title: `${i.osStr} ${i.version} ${(i.build != i.version) ? `(${i.build})` : ''}`,
      description: `Information for ${i.osStr} version ${i.version}`,
      layout: 'chartLayout',
      chartType: 'firmware',
      build: i,
      sidebar: false,
      editLink: false,
      lastUpdated: false,
      contributors: false,
    }
  })
}

for (var jb in jbList) {
  var redirects = []
  if (jbList[jb].hasOwnProperty('alias')) {
    redirects = jb.alias
    if (!Array.isArray(redirects)) redirects = [redirects]
    redirects = redirects.map(x=> jbPath + x)
  }

  const urlPart = jbList[jb].name.replace(/ /g, '-')
  const url = [jbPath, urlPart].join('/') + '.html'

  pageList.push({
    path: url,
    frontmatter: {
      title: jbList[jb].name,
      description: `Compatible devices and software versions for ${jbList[jb].name}`,
      layout: 'chartLayout',
      chartType: 'jailbreak',
      jailbreak: jbList[jb],
      redirect_from: redirects,
      sidebar: false,
      editLink: false,
      lastUpdated: false,
      contributors: false,
    }
  })
}

function getDevicePage(args) {
  if (!Array.isArray(args.devArr)) args.devArr = [args.devArr]
  const devArr = args.devArr
  const name = args.name
  const devPath = args.path
  const description = args.description
  const grouped = args.grouped
  const mainList = args.mainList
  const hideChildren = args.hideChildren

  const devFwArr = iosList.filter(i => {
    const fwDevArr = Object.keys(i.devices)
    const devIdArr = devArr.map(x => x.identifier)
    for (const id of devIdArr) if (fwDevArr.includes(id)) return true
    return false
  })
  
  const devFwVersionArr = devFwArr.map(x => [x.osStr,x.version].join(' '))
  const duplicateVersionArr = devFwVersionArr.filter((fw, index) => index !== devFwVersionArr.indexOf(fw))

  function getDevType(type) {
    if (type.includes('iPad') || type == 'iPhone' || type == 'iPod') return 'iPhone, iPad, iPod'
    if (type.includes('Mac') || type == 'Developer Transition Kit') return 'Mac'
    return type
  }

  const getVersionArr = devFwArr.map(i => {
    let dlArr = Object.keys(i.devices)
    .filter(x => devArr.map(x => x.identifier).includes(x))
    .map(x => {
      if (!i.devices[x] || !i.devices[x].ipsw || i.devices[x].ipsw == 'none') return undefined
      return {
        deviceName: devArr.filter(y => y.identifier == x)[0].name,
        identifier: x,
        label: i.devices[x].ipsw.split('/')[i.devices[x].ipsw.split('/').length-1],
        url: i.devices[x].ipsw
      }
    }).filter(x => x)

    urlCount = Array.from(new Set(dlArr.map(x => x.url))).length
    if (urlCount == 1) dlArr = [dlArr[0]]

    const devIdFwArr = Object.keys(i.devices).filter(x => devArr.map(x => x.identifier).includes(x))
    const devTypeArr = Array.from(
      new Set(
        devIdFwArr.map(x => devArr.filter(y => y.identifier == x)[0])
                  .map(x => x.type)
                  .map(x => getDevType(x))
      )
    )

    const releasedArr = i.released.split('-')
    const dateStyleArr = [{ year: 'numeric'}, { dateStyle: 'medium'}, { dateStyle: 'medium'}]
    const released = new Intl.DateTimeFormat('en-US', dateStyleArr[releasedArr.length-1]).format(new Date(i.released))

    return {
      osStr: i.osStr,
      version: i.version,
      build: i.build,
      duplicateVersion: duplicateVersionArr.includes([i.osStr,i.version].join(' ')),
      url: `/${i.osStr.replace(/ /g, '-')}/${i.uniqueBuild}.html`,
      released: i.released,
      beta: i.beta,
      releasedStr: released,
      devices: devIdFwArr,
      deviceFilterArr: (mainList) ?
        devTypeArr :
        devIdFwArr,
      jailbreakArr: Array.from(
        new Set(
          devArr.map(d => d.identifier)
                .map(d => bigObj[i.build][d])
                .flat()
                .map(x => x ? x.name : x)
        )
      ).filter(x => x),
      downloads: dlArr
    }
  }).reverse()

  const osStr = Array.from(new Set(getVersionArr.map(x => x.osStr)))

  const head = (mainList) ? [] : [
    [
      "meta",
      {
        property: "og:image",
        content: `/assets/images/device@512/${devArr[0].identifier}/0.png`
      }
    ]
  ]

  const propertyArr = ['name','identifier','soc','arch','model','board']
  const infoArr = devArr.map(x => {
    var o = {}
    for (const p of propertyArr) if (x[p]) o[p] = x[p]
    return o
  })

  const hasJbArr = [
    'iOS',
    'tvOS',
    'audioOS',
    'watchOS',
    'iPhoneOS',
    'iPadOS',
    'Apple TV Software'
  ]

  var imgCount = 0
  try {
    imgCount = fs.readdirSync(`docs/.vuepress/public/assets/images/device@256/${devArr[0].identifier}/`).length
  } catch {
    imgCount = 0
  }

  return {
    path: devPath,
    frontmatter: {
      title: name,
      description: description || `Information lookup for ${name}`,
      layout: 'chartLayout',
      chartType: 'device',
      device: infoArr,
      versionArr: getVersionArr,
      grouped: grouped,
      hideChildren: hideChildren,
      imgCount: imgCount,
      mainList: mainList,
      noJb: (!(osStr.some(r => hasJbArr.includes(r))) && !mainList),
      deviceFilter: (mainList) ? 
        Array.from(new Set(devArr.map(x => getDevType(x.type)))).sort().map(x => {
          return {
            label: x,
            value: x
          }
        }) :
        [devArr].map(x => {
          const nameArr = x.map(y => y.name)
          const idenArr = x.map(y => y.identifier)
          return {
            label: nameArr.join(', '),
            value: idenArr
          }
        }).concat(devArr.map(x => {
          return {
            label: x.name,
            value: [x.identifier]
          }
        })),

      head: head,

      sidebar: false,
      editLink: false,
      lastUpdated: false,
      contributors: false
    }
  }
}

for (const d of Object.keys(deviceList).map(x => deviceList[x])) {
  const urlPart = d.identifier.replace(/ /g, '-')
  const url = [devicePath, urlPart].join('/') + '.html'
  pageList.push(
    getDevicePage({
      name: d.name,
      path: url,
      devArr: d,
      grouped: false
    })
  )
}

for (const g of deviceGroups) {
  const urlPart = g.name.replace(/ /g, '-')
  const url = [devicePath, urlPart].join('/') + '.html'
  pageList.push(
    getDevicePage({
      name: g.name,
      path: url,
      devArr: g.devices.map(x => deviceList[x]),
      grouped: true,
      hideChildren: g.hideChildren
    })
  )
}

var devListFromFw = []
for (const i of iosList.map(x => Object.keys(x.devices))) devListFromFw.push(...i)
devListFromFw = Array.from(new Set(devListFromFw)).sort()

pageList.push(
  getDevicePage({
    name: "Firmware Chart",
    description: 'AppleDB firmware chart',
    path: "/firmwares.html",
    devArr: devListFromFw.map(x => deviceList[x]),
    grouped: true,
    mainList: true
  })
)

pageList.push({
  path: '/device-list.html',
  frontmatter: {
    title: 'Device List',
    description: 'AppleDB device list',
    layout: 'chartLayout',
    chartType: 'deviceList',
    deviceList: deviceGroups,
    sidebar: false,
    editLink: false,
    lastUpdated: false,
    contributors: false,
  }
})

pageList.push({
  path: '/device-selection.html',
  frontmatter: {
    title: 'Device Selection',
    description: 'AppleDB device selection',
    layout: 'chartLayout',
    chartType: 'deviceGroupList',
    redirect_from: ['/devices','/devices.html','/device','/device.html'],
    groupList: deviceGroups,
    sidebar: false,
    editLink: false,
    lastUpdated: false,
    contributors: false,
  }
})

Array.from(new Set(deviceGroups.map(x => x.type))).map(function(t) {
  const urlPart = t.toLowerCase().replace(/ /g, '-')
  const url = `/device-selection/${urlPart}.html`
  pageList.push({
    path: url,
    frontmatter: {
      title: `Device Selection (${t})`,
      description: 'AppleDB device selection',
      layout: 'chartLayout',
      chartType: 'deviceGroup',
      type: t,
      group: deviceGroups.filter(x => x.type == t),
      sidebar: false,
      editLink: false,
      lastUpdated: false,
      contributors: false,
    }
  })
})

module.exports = function() {
  return {
    name: 'vuepress-new-dynamic-pages',
    async onInitialized(app) {
      for (const p in pageList) app.pages.push(await createPage(app, pageList[p]))
    },
    onPrepared: async (app) => {
      await app.writeTemp('main.js', `export default ${JSON.stringify(bigJson)}`)
    }
  }
}