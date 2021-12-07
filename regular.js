const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/regular.js')
const fs = require('fs')
const path = require('path')
const EventEmitter = require('events').EventEmitter

let storage = null
let atStart = null
let atLoad = null
let busyAndNotReady = null
let check = null
let takeOutInActive = null
let start = null
let webtorrent = null
let webproperty = null

async function startUp(self){
    busyAndNotReady = true
    self.emit('checked', false)
    if(atStart.clear){
        for(let i = 0;i < webtorrent.torrents.length;i++){
            await new Promise((resolve, reject) => {
                webtorrent.remove(webtorrent.torrents[i].infoHash, {destroyStore: false}, error => {
                    if(error){
                        reject(false)
                    } else {
                        resolve(true)
                    }
                })
            })
        }
    }
    let props = webproperty.getAll(null)
    let dirs = await new Promise((resolve, reject) => {
        fs.readdir(storage, {withFileTypes: false}, (error, files) => {
            if(error){
                reject(null)
            } else if(files){
                resolve(files)
            } else {
                reject(null)
            }
        })
    })
    // let has = props.filter(data => {return dirs.includes(data.address)})
    if(atStart.clear || atStart.share){
        props = props.map(data => {return data.address})
        let hasNot = dirs.filter(data => {return !props.includes(data)})
        for(let i = 0;i < hasNot.length;i++){
            if(atStart.clear){
                await new Promise((resolve, reject) => {
                    fs.rm(path.resolve(storage + path.sep + hasNot[i]), {recursive: true, force: true}, error => {
                        if(error){
                            reject(false)
                        } else {
                            resolve(true)
                        }
                    })
                })
            }
            if(atStart.share){
                await new Promise((resolve) => {
                    webtorrent.seed(path.resolve(storage + path.sep + hasNot[i]), {destroyStoreOnDestroy: true}, torrent => {
                        torrent.address = hasNot[i]
                        torrent.managed = false
                        resolve(torrent)
                    })
                })
            }
        }
    }
    // if(has.length){
    //     for(let i = 0;i < has.length;i++){
    //         await new Promise((resolve) => {
    //             webtorrent.seed(path.resolve(storage + path.sep + has[i].address), {destroyStoreOnDestroy: true}, torrent => {
    //                 torrent.address = has[i].address
    //                 torrent.sequence = has[i].sequence
    //                 torrent.active = has[i].active
    //                 torrent.signed = has[i].signed
    //                 torrent.magnet = has[i].magnet
    //                 torrent.sig = has[i].sig
    //                 torrent.managed = true
    //                 resolve(torrent)
    //             })
    //         })
    //     }
    // }
    self.emit('checked', true)
    busyAndNotReady = false
}

async function removeUnManaged(self){
    let tempTorrents = webtorrent.torrents.filter(data => {return !data.managed})
    for(let i = 0;i < tempTorrents.length;i++){
        await new Promise((resolve, reject) => {
            webtorrent.remove(tempTorrents[i].infoHash, {destroyStore: true}, error => {
                if(error){
                    self.emit('error', error)
                    reject(error)
                } else {
                    self.emit('dead', {address: tempTorrents[i].address, infoHash: tempTorrents[i].infoHash, sequence: tempTorrents[i].sequence})
                    resolve(tempTorrents[i])
                }
            })
        })
    }
}

// async function keepThingsUpdated(self){
    // busyAndNotReady = true
    // self.emit('checked', false)
    // let props = webproperty.getAll(null)
    // let allTorrents = webtorrent.torrents.map(data => {return data.infoHash})
    // let propz = props.map(data => {return data.infoHash})
    // let dropTorrents = allTorrents.filter(data => {return !propz.includes(data)})
    // let testTorrents = allTorrents.filter(data => {return propz.includes(data)})
    // let needTorrents = props.filter(data => {return !allTorrents.includes(data.infoHash)})
    // let updateTorrents = props.filter(data => {return allTorrents.includes(data.infoHash)})
    // for(let i = 0;i < dropTorrents.length;i++){
    //     await new Promise((resolve, reject) => {
    //         webtorrent.remove(dropTorrents[i], {destroyStore: true}, error => {
    //             if(error){
    //                 self.emit('error', error)
    //                 reject(false)
    //             } else {
    //                 resolve(true)
    //             }
    //         })
    //     })
    // }
    // for(let i = 0;i < needTorrents.length;i++){
    //     await new Promise(resolve => {
    //         webtorrent.add(needTorrents[i].infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
    //             torrent.address = needTorrents[i].address
    //             torrent.sequence = needTorrents[i].sequence
    //             torrent.active = needTorrents[i].active
    //             torrent.magnet = needTorrents[i].magnet
    //             torrent.signed = needTorrents[i].signed
    //             torrent.sig = needTorrents[i].sig
    //             torrent.managed = true
    //             resolve(torrent)
    //         })
    //     })
    // }
    // for(let i = 0;i < updateTorrents.length;i++){
    //     let tempTorrent = webtorrent.get(updateTorrents[i].infoHash)
    //     if(tempTorrent){
    //         tempTorrent.address = updateTorrents[i].address
    //         tempTorrent.sig = updateTorrents[i].sig
    //         tempTorrent.sequence = updateTorrents[i].sequence
    //         tempTorrent.active = updateTorrents[i].active
    //         tempTorrent.magnet = updateTorrents[i].magnet
    //         tempTorrent.signed = updateTorrents[i].signed
    //         tempTorrent.managed = true
    //     } else {
    //         await new Promise(resolve => {
    //             webtorrent.add(updateTorrents[i].infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
    //                 torrent.address = updateTorrents[i].address
    //                 torrent.sig = updateTorrents[i].sig
    //                 torrent.sequence = updateTorrents[i].sequence
    //                 torrent.active = updateTorrents[i].active
    //                 torrent.magnet = updateTorrents[i].magnet
    //                 torrent.signed = updateTorrents[i].signed
    //                 torrent.managed = true
    //                 resolve(torrent)
    //             })
    //         })
    //     }
    // }
//     self.emit('checked', true)
//     busyAndNotReady = false
// }

class TorrentProperty extends EventEmitter {
    constructor(opt){
        super()
        if(!opt){
            opt = {}
            opt.storage = path.resolve('./folder')
            opt.takeOutInActive = true
            opt.start = {clear: true, share: false}
            opt.load = true
            opt.check = false
        } else {
            if(!opt.storage){
                opt.storage = path.resolve('./folder')
            }
            if(!opt.takeOutInActive){
                opt.takeOutInActive = true
            }
            if(!opt.start){
                opt.start = {clear: true, share: false}
            }
            if(!opt.load){
                opt.load = true
            }
            if(!opt.check){
                opt.check = false
            }
        }
        // this.redo = []
        storage = path.resolve(opt.storage)
        atStart = opt.start
        atLoad = opt.load
        busyAndNotReady = false
        check = opt.check
        takeOutInActive = opt.takeOutInActive
        start = true
        if(!fs.existsSync(storage)){
            fs.mkdirSync(storage, {recursive: true})
        }
        webtorrent = new WebTorrent({dht: {verify}})
        webproperty = new WebProperty({dht: webtorrent.dht, takeOutInActive, check})
        webtorrent.on('error', error => {
            this.emit('error', error)
        })
        webproperty.on('error', error => {
            this.emit('error', error)
        })
        webproperty.on('update', data => {
            if(data.diffInfoHash){
                let tempTorrent = webtorrent.get(data.prevInfoHash)
                if(tempTorrent){
                    new Promise((resolve) => {
                        tempTorrent.destroy({destroyStore: true}, () => {
                            webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                                delete data.infoHash
                                for(let prop in data){
                                    torrent[prop] = data[prop]
                                }
                                // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                                this.emit('updated', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                                resolve(true)
                            })
                        })
                    }).catch(error => {this.emit('error', error)})
                } else {
                    new Promise((resolve) => {
                        webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                            delete data.infoHash
                            for(let prop in data){
                                torrent[prop] = data[prop]
                            }
                            // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                            this.emit('updated', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                            resolve(true)
                        })
                    }).catch(error => {this.emit('error', error)})
                }
            } else {
                let tempTorrent = webtorrent.get(data.infoHash)
                if(tempTorrent){
                    new Promise((resolve) => {
                        delete data.infoHash
                        for(let prop in data){
                            tempTorrent[prop] = data[prop]
                        }
                        this.emit('updated', {name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
                        resolve(true)
                    }).catch(error => {this.emit('error', error)})
                } else {
                    new Promise((resolve) => {
                        webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                            delete data.infoHash
                            for(let prop in data){
                                torrent[prop] = data[prop]
                            }
                            // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                            this.emit('updated', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                            resolve(true)
                        })
                    }).catch(error => {this.emit('error', error)})
                }
            }
        })
        webproperty.on('current', data => {
            let tempTorrent = webtorrent.get(data.infoHash)
            if(tempTorrent){
                new Promise((resolve) => {
                    delete data.infoHash
                    for(let prop in data){
                        tempTorrent[prop] = data[prop]
                    }
                    this.emit('same', {name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
                    resolve(true)
                }).catch(error => {this.emit('error', error)})
            } else {
                new Promise((resolve) => {
                    webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                        this.emit('same', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                        resolve(true)
                    })
                }).catch(error => {this.emit('error', error)})
            }
        })
        if(!takeOutInActive){
            webproperty.on('deactivate', data => {
                if(data.diffInfoHash){
                    let prevTorrent = webtorrent.get(data.prevInfoHash)
                    if(prevTorrent){
                        new Promise((resolve) => {
                            prevTorrent.destroy({destroyStore: true}, () => {
                                webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                                    delete data.infoHash
                                    for(let prop in data){
                                        torrent[prop] = data[prop]
                                    }
                                    // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                                    this.emit('deactivated', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                                    resolve(true)
                                })
                            })
                        }).catch(error => {this.emit('error', error)})
                    } else {
                        tempTorrent = webtorrent.get(data.infoHash)
                        if(tempTorrent){
                            new Promise((resolve) => {
                                delete data.infoHash
                                for(let prop in data){
                                    tempTorrent[prop] = data[prop]
                                }
                                this.emit('deactivated', {name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
                                resolve(true)
                            }).catch(error => {this.emit('error', error)})
                        } else {
                            new Promise((resolve) => {
                                webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                                    delete data.infoHash
                                    for(let prop in data){
                                        torrent[prop] = data[prop]
                                    }
                                    // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                                    this.emit('deactivated', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                                    resolve(true)
                                })
                            }).catch(error => {this.emit('error', error)})
                        }
                    }
                } else {
                    let tempTorrent = webtorrent.get(data.infoHash)
                    if(tempTorrent){
                        new Promise((resolve) => {
                            delete data.infoHash
                            for(let prop in data){
                                tempTorrent[prop] = data[prop]
                            }
                            this.emit('deactivated', {name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
                            resolve(true)
                        }).catch(error => {this.emit('error', error)})
                    } else {
                        new Promise((resolve) => {
                            webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                                delete data.infoHash
                                for(let prop in data){
                                    torrent[prop] = data[prop]
                                }
                                // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                                this.emit('deactivated', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                                resolve(true)
                            })
                        }).catch(error => {this.emit('error', error)})
                    }
                }
            })
        }
        if(!takeOutInActive){
            webproperty.on('inactive', data => {
                if(data.diffInfoHash){
                    let prevTorrent = webtorrent.get(data.prevInfoHash)
                    if(prevTorrent){
                        new Promise((resolve) => {
                            prevTorrent.destroy({destroyStore: true}, () => {
                                webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                                    delete data.infoHash
                                    for(let prop in data){
                                        torrent[prop] = data[prop]
                                    }
                                    // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                                    this.emit('frozen', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                                    resolve(true)
                                })
                            })
                        }).catch(error => {this.emit('error', error)})
                    } else {
                        tempTorrent = webtorrent.get(data.infoHash)
                        if(tempTorrent){
                            new Promise((resolve) => {
                                delete data.infoHash
                                for(let prop in data){
                                    tempTorrent[prop] = data[prop]
                                }
                                this.emit('frozen', {name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
                                resolve(true)
                            }).catch(error => {this.emit('error', error)})
                        } else {
                            new Promise((resolve) => {
                                webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                                    delete data.infoHash
                                    for(let prop in data){
                                        torrent[prop] = data[prop]
                                    }
                                    // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                                    this.emit('frozen', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                                    resolve(true)
                                })
                            }).catch(error => {this.emit('error', error)})
                        }
                    }
                } else {
                    let tempTorrent = webtorrent.get(data.infoHash)
                    if(tempTorrent){
                        new Promise((resolve) => {
                            delete data.infoHash
                            for(let prop in data){
                                tempTorrent[prop] = data[prop]
                            }
                            this.emit('frozen', {name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
                            resolve(true)
                        }).catch(error => {this.emit('error', error)})
                    } else {
                        new Promise((resolve) => {
                            webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                                delete data.infoHash
                                for(let prop in data){
                                    torrent[prop] = data[prop]
                                }
                                // let {name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                                this.emit('frozen', {name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                                resolve(true)
                            })
                        }).catch(error => {this.emit('error', error)})
                    }
                }
            })
        }
        if(takeOutInActive){
            webproperty.on('dead', data => {
                if(data.diffInfoHash){
                    let prevTorrent = webtorrent.get(data.prevInfoHash)
                    let nowTorrent = webtorrent.get(data.infoHash)
                    if(prevTorrent){
                        new Promise((resolve) => {
                            prevTorrent.destroy({destroyStore: true}, () => {
                                resolve(true)
                            })
                        }).catch(error => {this.emit('error', error)})
                    }
                    if(nowTorrent){
                        new Promise((resolve) => {
                            nowTorrent.destroy({destroyStore: true}, () => {
                                resolve(true)
                            })
                        }).catch(error => {this.emit('error', error)})
                    }
                } else {
                    let dataTorrent = webtorrent.get(data.infoHash)
                    if(dataTorrent){
                        new Promise((resolve) => {
                            dataTorrent.destroy({destroyStore: true}, () => {
                                resolve(true)
                            })
                        }).catch(error => {this.emit('error', error)})
                    }
                }
            })
        }
        webproperty.on('check', data => {
            if(data){
                if(start){
                    startUp(this).catch(error => {
                        this.emit('error', error)
                })
                start = false
            }
        }
            this.emit('checked', data)
        })
        // this.checks = []
    }

load(address, manage, callback){
    if(!callback){
        callback = function(){}
    }

    if(atLoad){
        let tempTorrents = webtorrent.torrents.filter(data => {return !data.managed})
        for(let i = 0;i < tempTorrents.length;i++){
            webtorrent.remove(tempTorrents[i].infoHash, {destroyStore: true})
        }
    }

    webproperty.resolve(address, manage, (error, data) => {
        if(error){
            return callback(error)
        } else {
            webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: true}, torrent => {
                torrent.address = data.address
                torrent.sig = data.sig
                torrent.sequence = data.sequence
                torrent.active = data.active
                torrent.signed = data.signed
                torrent.magnet = data.magnet
                torrent.managed = manage
                return callback(null, {torrent, data})
            })
        }
    })
}
publish(folder, keypair, sequence, manage, callback){
    if(!callback){
        callback = function(){}
    }
    // if((!folder || typeof(folder) !== 'string') || (!folder.includes('/') && !folder.includes('\\')) || path.resolve(folder).split(path.sep).length < 2){
    //     return callback(new Error('must have folder'))
    // }
    if((!folder || typeof(folder) !== 'string') || (!folder.includes('/') && !folder.includes('\\'))){
        return callback(new Error('must have folder'))
    }
    if((!keypair) || (!keypair.address || !keypair.secret)){
        keypair = webproperty.createKeypair(null)
    }
    try {
        folder = {main: path.resolve(folder).split(path.sep).filter(Boolean)}
        folder.old = folder.main.pop()
        folder.new = keypair.address
        folder.main = folder.main.join(path.sep)
        folder.old = path.resolve(folder.main + path.sep + folder.old)
        folder.new = path.resolve(folder.main + path.sep + folder.new)
        delete folder.main
    } catch (error) {
        return callback(error)
    }
    fs.rename(folder.old, folder.new, error => {
        if(error){
            return callback(error)
        } else {
            webtorrent.seed(folder.new, {destroyStoreOnDestroy: true}, torrent => {
                webproperty.publish(keypair, torrent.infoHash, sequence, manage, (error, data) => {
                    if(error){
                        webtorrent.remove(torrent.infoHash, {destroyStore: true}, resError => {
                            if(resError){
                                return callback(resError)
                            } else {
                                return callback(error)
                            }
                        })
                    } else {
                        torrent.address = data.address
                        torrent.sig = data.sig
                        torrent.sequence = data.sequence
                        torrent.active = data.active
                        torrent.signed = data.signed
                        torrent.magnet = data.magnet
                        torrent.managed = manage
                        return callback(null, {torrent, data})
                    }
                })
            })
        }
    })
}
remove(address, manage, callback){
    if(!callback){
        callback = function(){}
    }
    if(manage){
        webproperty.shred(address, (resError, resProp) => {
            if(resError){
                return callback(resError)
            } else {
                let tempTorrent = this.findTheTorrent(resProp.address)
                if(tempTorrent){
                    webtorrent.remove(tempTorrent.infoHash, {destroyStore: true}, error => {
                        if(error){
                            return callback(error)
                        } else {
                            return callback(null, {torrent: tempTorrent, data: resProp})
                        }
                    })
                } else {
                    return callback(new Error('can not find torrent'))
                }
            }
        })
    } else {
        let tempTorrent = this.findTheTorrent(address)
        if(tempTorrent){
            webtorrent.remove(tempTorrent.infoHash, {destroyStore: true}, error => {
                if(error){
                    return callback(error)
                } else {
                    return callback(null, tempTorrent)
                }
            })
        } else {
            return callback(new Error('did not find torrent'))
        }
    }
}
findTheTorrent(address){
    let tempTorrent = null
    for(let i = 0;i < webtorrent.torrents.length;i++){
        if(webtorrent.torrents[i].address === address){
            tempTorrent = webtorrent.torrents[i]
            break
        }
    }
    return tempTorrent
}
}

module.exports = TorrentProperty