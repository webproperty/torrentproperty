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
let webtorrent = null
let webproperty = null
let clean = null

async function startUp(self){
    busyAndNotReady = true
    self.emit('checked', false)
    if(atStart){
        let dirs = await new Promise((resolve, reject) => {
            fs.readdir(storage, {withFileTypes: false}, (error, files) => {
                if(error){
                    self.emit('error', error)
                    reject(null)
                } else if(files){
                    resolve(files)
                } else {
                    reject(null)
                }
            })
        })
        let props = webproperty.getAll(null).map(data => {return data.address})
        dirs = dirs.filter(data => {return !props.includes(data)})
        if(atStart.clear){
            for(let i = 0;i < dirs.length;i++){
                await new Promise((resolve, reject) => {
                    fs.rm(storage + path.sep + dirs[i], {recursive: true, force: true}, error => {
                        if(error){
                            self.emit('error', error)
                            reject(false)
                        } else {
                            resolve(true)
                        }
                    })
                })
            }
        } else if(atStart.share){
            for(let i = 0;i < dirs.length;i++){
                await new Promise((resolve) => {
                    webtorrent.seed(storage + path.sep + dirs[i], {destroyStoreOnDestroy: clean}, torrent => {
                        torrent.address = dirs[i]
                        torrent.managed = false
                        resolve(torrent)
                    })
                })
            }
        }
        props = null
        dirs = null
    }
    self.emit('checked', true)
    busyAndNotReady = false
}

async function removeUnManaged(self){
    let tempTorrents = webtorrent.torrents.filter(data => {return !data.managed})
    for(let i = 0;i < tempTorrents.length;i++){
        await new Promise((resolve, reject) => {
            webtorrent.remove(tempTorrents[i].infoHash, {destroyStore: clean}, error => {
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

function mainHandle(self){
    webproperty.on('update', data => {
        if(data.diffInfoHash){
            let tempTorrent = webtorrent.get(data.prevInfoHash)
            if(tempTorrent){
                // new Promise((resolve, reject) => {
                //     webtorrent.remove(tempTorrent.infoHash, {destroyStore: clean}, (error) => {
                //         if(error){
                //             reject(error)
                //         } else {
                //             resolve(tempTorrent.address)
                //         }
                //     })
                // }).then(res => {self.emit('removed', res)}).catch(error => {self.emit('error', error)})
                webtorrent.remove(tempTorrent.infoHash, {destroyStore: clean}, (error) => {
                    if(error){
                        self.emit('error', error)
                    } else {
                        self.emit('removed', tempTorrent.address)
                    }
                })
            } else {
                self.emit('error', 'could not find ' + data.prevInfoHash)
            }
        }
        let tempTorrent = webtorrent.get(data.infoHash)
        if(tempTorrent){
            // new Promise((resolve) => {
            //     delete data.infoHash
            //     for(let prop in data){
            //         tempTorrent[prop] = data[prop]
            //     }
            //     // self.emit('updated', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
            //     resolve({stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
            // }).then(res => {self.emit('updated', res)}).catch(error => {self.emit('error', error)})
            delete data.infoHash
            for(let prop in data){
                tempTorrent[prop] = data[prop]
            }
            self.emit('updated', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
        } else {
            // new Promise((resolve) => {
            //     webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
            //         delete data.infoHash
            //         for(let prop in data){
            //             torrent[prop] = data[prop]
            //         }
            //         // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
            //         // self.emit('updated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
            //         resolve({stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
            //     })
            // }).then(res => {self.emit('updated', res)}).catch(error => {self.emit('error', error)})
            webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                delete data.infoHash
                for(let prop in data){
                    torrent[prop] = data[prop]
                }
                // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                self.emit('updated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
            })
        }
    })
    webproperty.on('current', data => {
        if(data.diffInfoHash){
            let prevTorrent = webtorrent.get(data.prevInfoHash)
            if(prevTorrent){
                // new Promise((resolve, reject) => {
                //     webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                //         if(error){
                //             reject(error)
                //         } else {
                //             resolve(prevTorrent.address)
                //         }
                //     })
                // }).then(res => {self.emit('same', res)}).catch(error => {self.emit('error', error)})
                webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                    if(error){
                        self.emit('error', error)
                    } else {
                        self.emit('removed',prevTorrent.address)
                    }
                })
            } else {
                self.emit('error', new Error('could not find ' + data.prevInfoHash))
            }
        }
        let tempTorrent = webtorrent.get(data.infoHash)
        if(tempTorrent){
            // new Promise((resolve) => {
            //     delete data.infoHash
            //     for(let prop in data){
            //         tempTorrent[prop] = data[prop]
            //     }
            //     // self.emit('same', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
            //     resolve({stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
            // }).then(res => {self.emit('same', res)}).catch(error => {self.emit('error', error)})
            delete data.infoHash
            for(let prop in data){
                tempTorrent[prop] = data[prop]
            }
            self.emit('same', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
        } else {
            // new Promise((resolve) => {
            //     webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
            //         delete data.infoHash
            //         for(let prop in data){
            //             torrent[prop] = data[prop]
            //         }
            //         // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
            //         // self.emit('same', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
            //         resolve({stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
            //     })
            // }).then(res => {self.emit('same', res)}).catch(error => {self.emit('error', error)})
            webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                delete data.infoHash
                for(let prop in data){
                    torrent[prop] = data[prop]
                }
                // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                self.emit('same', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
            })
        }
    })
    if(!takeOutInActive){
        webproperty.on('deactivate', data => {
            if(data.diffInfoHash){
                let prevTorrent = webtorrent.get(data.prevInfoHash)
                if(prevTorrent){
                    // new Promise((resolve, reject) => {
                    //     webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                    //         if(error){
                    //             reject(error)
                    //         } else {
                    //             resolve(prevTorrent.address)
                    //         }
                    //     })
                    // }).then(res => {self.emit('removed', res)}).catch(error => {self.emit('error', error)})
                    webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                        if(error){
                            self.emit('error', error)
                        } else {
                            self.emit('removed',prevTorrent.address)
                        }
                    })
                } else {
                    self.emit('error', 'could not find ' + data.prevInfoHash)
                }
            }
            let tempTorrent = webtorrent.get(data.infoHash)
            if(tempTorrent){
                // new Promise((resolve) => {
                //     delete data.infoHash
                //     for(let prop in data){
                //         tempTorrent[prop] = data[prop]
                //     }
                //     self.emit('deactivated', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
                //     resolve({stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
                // }).then(res => {self.emit('deactivated', res)}).catch(error => {self.emit('error', error)})
                delete data.infoHash
                for(let prop in data){
                    tempTorrent[prop] = data[prop]
                }
                self.emit('deactivated', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
            } else {
                // new Promise((resolve) => {
                //     webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                //         delete data.infoHash
                //         for(let prop in data){
                //             torrent[prop] = data[prop]
                //         }
                //         // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                //         // self.emit('deactivated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                //         resolve({stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                //     })
                // }).then(res => {self.emit('deactivated', res)}).catch(error => {self.emit('error', error)})
                webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                    self.emit('deactivated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            }
        })
    }
    if(!takeOutInActive){
        webproperty.on('inactive', data => {
            if(data.diffInfoHash){
                let prevTorrent = webtorrent.get(data.prevInfoHash)
                if(prevTorrent){
                    // new Promise((resolve, reject) => {
                    //     webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                    //         if(error){
                    //             reject(error)
                    //         } else {
                    //             self.emit('removed', prevTorrent.address)
                    //         }
                    //     })
                    // }).catch(error => {self.emit('error', error)})
                    webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                        if(error){
                            self.emit('error', error)
                        } else {
                            self.emit('removed', prevTorrent.address)
                        }
                    })
                } else {
                    self.emit('error', 'could not find ' + data.prevInfoHash)
                }
            }
            let tempTorrent = webtorrent.get(data.infoHash)
            if(tempTorrent){
                // new Promise((resolve) => {
                //     delete data.infoHash
                //     for(let prop in data){
                //         tempTorrent[prop] = data[prop]
                //     }
                //     self.emit('frozen', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
                //     resolve(tempTorrent)
                // }).catch(error => {self.emit('error', error)})
                delete data.infoHash
                for(let prop in data){
                    tempTorrent[prop] = data[prop]
                }
                self.emit('frozen', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
            } else {
                // new Promise((resolve) => {
                //     webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                //         delete data.infoHash
                //         for(let prop in data){
                //             torrent[prop] = data[prop]
                //         }
                //         // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                //         self.emit('frozen', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                //         resolve(torrent)
                //     })
                // }).catch(error => {self.emit('error', error)})
                webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                    self.emit('frozen', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            }
        })
    }
    if(takeOutInActive){
        webproperty.on('remove', data => {
            if(data.diffInfoHash){
                let prevTorrent = webtorrent.get(data.prevInfoHash)
                if(prevTorrent){
                    // new Promise((resolve, reject) => {
                    //     webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                    //         if(error){
                    //             reject(error)
                    //         } else {
                    //             resolve(prevTorrent.address)
                    //         }
                    //     })
                    // }).then(res => {self.emit('removed', res)}).catch(error => {self.emit('error', error)})
                    webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                        if(error){
                            self.emit('error', error)
                        } else {
                            self.emit('removed', prevTorrent.address)
                        }
                    })
                } else {
                    self.emit('error', new Error('could not find ' + data.prevInfoHash))
                }
            }
            let dataTorrent = webtorrent.get(data.infoHash)
            if(dataTorrent){
                // new Promise((resolve, reject) => {
                //     webtorrent.remove(dataTorrent.infoHash, {destroyStore: clean}, (error) => {
                //         if(error){
                //             reject(error)
                //         } else {
                //             resolve(dataTorrent.address)
                //         }
                //     })
                // }).then(res => {self.emit('removed', res)}).catch(error => {self.emit('error', error)})
                webtorrent.remove(dataTorrent.infoHash, {destroyStore: clean}, (error) => {
                    if(error){
                        self.emit('error', error)
                    } else {
                        self.emit('removed', dataTorrent.address)
                    }
                })
            } else {
                self.emit('error', new Error('could not find ' + data.infoHash))
            }
        })
    }
}

class TorrentProperty extends EventEmitter {
    constructor(opt){
        super()
        if(!opt){
            opt = {}
            opt.storage = path.resolve('./folder')
            opt.takeOutInActive = true
            opt.start = {clear: true, share: false}
            opt.load = false
            opt.check = false
            opt.clean = false
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
                opt.load = false
            }
            if(!opt.check){
                opt.check = false
            }
            if(!opt.clean){
                opt.clean = false
            }
        }
        storage = path.resolve(opt.storage)
        atStart = opt.start
        atLoad = opt.load
        busyAndNotReady = false
        check = opt.check
        clean = opt.clean
        takeOutInActive = opt.takeOutInActive
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

        mainHandle(this)

        webproperty.on('check', beforeFunc)

        let beforeFunc = (data) => {
            if(data){
                startUp(this).catch(error => {
                    this.emit('error', error)
                })
                webproperty.off('check', beforeFunc)
                webproperty.on('check', afterFunc)
            }
        }

        let afterFunc = (data) => {
            this.emit('checked', {status: data, torrents: webtorrent.torrents.length, properties: webproperty.properties.length})
        }
    }

load(address, manage, callback){
    if(!callback){
        callback = function(){}
    }

    if(atLoad){
        let tempTorrents = webtorrent.torrents.filter(data => {return !data.managed})
        for(let i = 0;i < tempTorrents.length;i++){
            webtorrent.remove(tempTorrents[i].infoHash, {destroyStore: clean})
        }
    }

    webproperty.resolve(address, manage, (error, data) => {
        if(error){
            return callback(error)
        } else {
            webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                delete data.infoHash
                for(let prop in data){
                    torrent[prop] = data[prop]
                }
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
    } else {
        folder = path.resolve(folder)
    }
    if((!keypair) || (!keypair.address || !keypair.secret)){
        keypair = webproperty.createKeypair(null)
    }
    fs.access(folder, fs.constants.F_OK, error => {
        if(error){
            return callback(error)
        } else {
            webtorrent.seed(folder.new, {destroyStoreOnDestroy: clean}, torrent => {
                webproperty.publish(keypair, {ih: torrent.infoHash}, sequence, manage, (error, data) => {
                    if(error){
                        return callback(error)
                    } else {
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
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
                    webtorrent.remove(tempTorrent.infoHash, {destroyStore: clean}, error => {
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
            webtorrent.remove(tempTorrent.infoHash, {destroyStore: clean}, error => {
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