const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/managed.js')
const fs = require('fs')
const path = require('path')
const EventEmitter = require('events').EventEmitter

let busyAndNotReady = null
let storage = null
let takeOutInActive = null
let check = null
let webtorrent = null
let webproperty = null
let clean = null

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
            data.infohash = data.infoHash
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
            if(data.signed){
                webtorrent.seed(storage + path.sep + data.address, {destroyStoreOnDestroy: clean}, torrent => {
                    data.infohash = data.infoHash
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                    self.emit('updated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            } else {
                webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                    data.infohash = data.infoHash
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                    self.emit('updated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            }
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
            data.infohash = data.infoHash
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
            if(data.signed){
                webtorrent.seed(storage + path.sep + data.address, {destroyStoreOnDestroy: clean}, torrent => {
                    data.infohash = data.infoHash
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                    self.emit('same', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            } else {
                webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                    data.infohash = data.infoHash
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                    self.emit('same', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            }
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
                data.infohash = data.infoHash
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
                if(data.signed){
                    webtorrent.seed(storage + path.sep + data.address, {destroyStoreOnDestroy: clean}, torrent => {
                        data.infohash = data.infoHash
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                        self.emit('deactivated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                    })
                } else {
                    webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                        data.infohash = data.infoHash
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                        self.emit('deactivated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                    })
                }
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
                data.infohash = data.infoHash
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
                if(data.signed){
                    webtorrent.seed(storage + path.sep + data.address, {destroyStoreOnDestroy: clean}, torrent => {
                        data.infohash = data.infoHash
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                        self.emit('frozen', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                    })
                } else {
                    webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                        data.infohash = data.infoHash
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        // let {stuff, name, path, magnet, address, infoHash, sequence, active, signed, sig} = torrent
                        self.emit('frozen', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                    })
                }
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
            opt.takeOutInActive = false
            opt.check = false
            opt.clean = false
        } else {
            if(!opt.storage){
                opt.storage = path.resolve('./folder')
            }
            if(!opt.takeOutInActive){
                opt.takeOutInActive = false
            }
            if(!opt.check){
                opt.check = false
            }
            if(!opt.clean){
                opt.clean = false
            }
        }
        busyAndNotReady = false
        storage = path.resolve(opt.storage)
        takeOutInActive = opt.takeOutInActive
        check = opt.check
        clean = opt.clean
        webtorrent = new WebTorrent({dht: {verify}})
        webproperty = new WebProperty({dht: webtorrent.dht, takeOutInActive, check})
        if(!fs.existsSync(storage)){
            fs.mkdirSync(storage, {recursive: true})
        }
        webtorrent.on('error', error => {
            this.emit('error', error)
        })
        webproperty.on('error', error => {
            this.emit('error', error)
        })

        mainHandle(this)

        webproperty.on('check', data => {
            this.emit('checked', {status: data, torrents: webtorrent.torrents.length, properties: webproperty.properties.length})
        })
    }

    load(address, callback){
        if(!callback){
            callback = function(){}
        }
        webproperty.resolve(address, (error, data) => {
            if(error){
                return callback(error)
            } else {
                webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                    data.infohash = data.infoHash
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    return callback(null, {torrent, data})
                })
            }
        })
    }
    publish(folder, keypair, sequence, callback){
        if(!callback){
            callback = function(){}
        }
        if((!folder || typeof(folder) !== 'string') || (!folder.includes('/') && !folder.includes('\\'))){
            return callback(new Error('must have folder'))
        } else {
            folder = path.resolve(folder)
        }
        if((!keypair) || (!keypair.address || !keypair.secret)){
            keypair = webproperty.createKeypair()
        }
        fs.cp(folder, storage + path.sep + keypair.address, {recursive: true, force: true}, error => {
            if(error){
                return callback(error)
            } else {
                webtorrent.seed(storage + path.sep + keypair.address, {destroyStoreOnDestroy: clean}, torrent => {
                    webproperty.publish(keypair, {ih: torrent.infoHash}, sequence, (mainError, data) => {
                        if(mainError){
                            return callback(mainError)
                        } else {
                            data.infohash = data.infoHash
                            delete data.infoHash
                            for(let prop in data){
                                torrent[prop] = data[prop]
                            }
                            return callback(null, {torrent, data})
                        }
                    })
                })
            }
        })
    }
    remove(address, callback){
        if(!callback){
            callback = function(){}
        }
        webproperty.shred(address, (resError, resProp) => {
            if(resError){
                return callback(resError)
            } else {
                    // this.webtorrent.remove(resProp.infoHash, {destroyStore: clean}, error => {
                    //     if(error){
                    //         return callback(error)
                    //     } else {
                    //         return callback(null, resProp)
                    //     }
                    // })
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
                    return callback(new Error('did not find torrent'))
                }
            }
        })
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