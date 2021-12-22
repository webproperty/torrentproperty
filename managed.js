const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/managed.js')
const fs = require('fs-extra')
const path = require('path')
const EventEmitter = require('events').EventEmitter

let busyAndNotReady = null
let storage = null
let takeOutInActive = null
let check = null
let clean = null

function mainHandle(self){
    self.webproperty.on('update', data => {
        if(data.diffInfoHash){
            let tempTorrent = self.webtorrent.get(data.prevInfoHash)
            if(tempTorrent){
                self.webtorrent.remove(tempTorrent.infoHash, {destroyStore: clean}, (error) => {
                    if(error){
                        self.emit('error', error)
                    } else {
                        self.emit('removed', data.prevInfoHash)
                    }
                })
            } else {
                self.emit('error', 'could not find ' + data.prevInfoHash)
            }
        }
        let tempTorrent = self.webtorrent.get(data.infoHash)
        if(tempTorrent){
            data.infohash = data.infoHash
            delete data.infoHash
            for(let prop in data){
                tempTorrent[prop] = data[prop]
            }
            self.emit('updated', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
        } else {
            if(data.signed){
                self.webtorrent.seed(storage + path.sep + data.address, {destroyStoreOnDestroy: clean}, torrent => {
                    data.infohash = data.infoHash
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    self.emit('updated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            } else {
                self.webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                    data.infohash = data.infoHash
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    self.emit('updated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            }
        }
    })
    self.webproperty.on('current', data => {
        if(data.diffInfoHash){
            let prevTorrent = self.webtorrent.get(data.prevInfoHash)
            if(prevTorrent){
                self.webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                    if(error){
                        self.emit('error', error)
                    } else {
                        self.emit('removed', data.prevInfoHash)
                    }
                })
            } else {
                self.emit('error', new Error('could not find ' + data.prevInfoHash))
            }
        }
        let tempTorrent = self.webtorrent.get(data.infoHash)
        if(tempTorrent){
            data.infohash = data.infoHash
            delete data.infoHash
            for(let prop in data){
                tempTorrent[prop] = data[prop]
            }
            self.emit('same', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
        } else {
            if(data.signed){
                self.webtorrent.seed(storage + path.sep + data.address, {destroyStoreOnDestroy: clean}, torrent => {
                    data.infohash = data.infoHash
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    self.emit('same', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            } else {
                self.webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                    data.infohash = data.infoHash
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    self.emit('same', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                })
            }
        }
    })
    if(!takeOutInActive){
        self.webproperty.on('deactivate', data => {
            if(data.diffInfoHash){
                let prevTorrent = self.webtorrent.get(data.prevInfoHash)
                if(prevTorrent){
                    self.webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                        if(error){
                            self.emit('error', error)
                        } else {
                            self.emit('removed', data.prevInfoHash)
                        }
                    })
                } else {
                    self.emit('error', 'could not find ' + data.prevInfoHash)
                }
            }
            let tempTorrent = self.webtorrent.get(data.infoHash)
            if(tempTorrent){
                data.infohash = data.infoHash
                delete data.infoHash
                for(let prop in data){
                    tempTorrent[prop] = data[prop]
                }
                self.emit('deactivated', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
            } else {
                if(data.signed){
                    self.webtorrent.seed(storage + path.sep + data.address, {destroyStoreOnDestroy: clean}, torrent => {
                        data.infohash = data.infoHash
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        self.emit('deactivated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                    })
                } else {
                    self.webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                        data.infohash = data.infoHash
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        self.emit('deactivated', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                    })
                }
            }
        })
    }
    if(!takeOutInActive){
        self.webproperty.on('inactive', data => {
            if(data.diffInfoHash){
                let prevTorrent = self.webtorrent.get(data.prevInfoHash)
                if(prevTorrent){
                    self.webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                        if(error){
                            self.emit('error', error)
                        } else {
                            self.emit('removed', data.prevInfoHash)
                        }
                    })
                } else {
                    self.emit('error', 'could not find ' + data.prevInfoHash)
                }
            }
            let tempTorrent = self.webtorrent.get(data.infoHash)
            if(tempTorrent){
                data.infohash = data.infoHash
                delete data.infoHash
                for(let prop in data){
                    tempTorrent[prop] = data[prop]
                }
                self.emit('frozen', {stuff: tempTorrent.stuff, name: tempTorrent.name, path: tempTorrent.path, magnet: tempTorrent.magnet, address: tempTorrent.address, infoHash: tempTorrent.infoHash, sequence: tempTorrent.sequence, active: tempTorrent.active, signed: tempTorrent.signed, sig: tempTorrent.sig})
            } else {
                if(data.signed){
                    self.webtorrent.seed(storage + path.sep + data.address, {destroyStoreOnDestroy: clean}, torrent => {
                        data.infohash = data.infoHash
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        self.emit('frozen', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                    })
                } else {
                    self.webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                        data.infohash = data.infoHash
                        delete data.infoHash
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        self.emit('frozen', {stuff: torrent.stuff, name: torrent.name, path: torrent.path, magnet: torrent.magnet, address: torrent.address, infoHash: torrent.infoHash, sequence: torrent.sequence, active: torrent.active, signed: torrent.signed, sig: torrent.sig})
                    })
                }
            }
        })
    }
    if(takeOutInActive){
        self.webproperty.on('remove', data => {
            if(data.diffInfoHash){
                let prevTorrent = self.webtorrent.get(data.prevInfoHash)
                if(prevTorrent){
                    self.webtorrent.remove(prevTorrent.infoHash, {destroyStore: clean}, (error) => {
                        if(error){
                            self.emit('error', error)
                        } else {
                            self.emit('removed', data.prevInfoHash)
                        }
                    })
                } else {
                    self.emit('error', new Error('could not find ' + data.prevInfoHash))
                }
            }
            let dataTorrent = self.webtorrent.get(data.infoHash)
            if(dataTorrent){
                self.webtorrent.remove(dataTorrent.infoHash, {destroyStore: clean}, (error) => {
                    if(error){
                        self.emit('error', error)
                    } else {
                        self.emit('removed', data.infohash)
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
        this.webtorrent = new WebTorrent({dht: {verify}})
        this.webproperty = new WebProperty({dht: this.webtorrent.dht, takeOutInActive, check})
        if(!fs.pathExistsSync(storage)){
            fs.ensureDirSync(storage)
        }
        this.webtorrent.on('error', error => {
            this.emit('error', error)
        })
        this.webproperty.on('error', error => {
            this.emit('error', error)
        })

        mainHandle(this)

        this.webproperty.on('extra', data => {
            this.emit('more', data)
        })

        this.webproperty.on('check', data => {
            this.emit('checked', {status: data, torrents: this.webtorrent.torrents.length, properties: this.webproperty.properties.length})
        })
    }

    load(address, callback){
        if(!callback){
            callback = function(){}
        }
        this.webproperty.resolve(address, (error, data) => {
            if(error){
                return callback(error)
            } else {

                data.infohash = data.infoHash
                delete data.infoHash
                
                let checkTorrent = this.findTheTorrent(data.address)
                if(checkTorrent){
                    if(checkTorrent.infoHash === data.infoHash){
                        for(let prop in data){
                            checkTorrent[prop] = data[prop]
                        }
                        return callback(null, {checkTorrent, data})
                    } else {
                        this.webtorrent.remove(checkTorrent.infoHash, {destroyStore: true}, checkError => {
                            if(checkError){
                                return callback(checkError)
                            } else {
                                this.webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                                    for(let prop in data){
                                        torrent[prop] = data[prop]
                                    }
                                    return callback(null, {torrent, data})
                                })
                            }
                        })
                    }
                } else {
                    this.webtorrent.add(data.infoHash, {path: storage, destroyStoreOnDestroy: clean}, torrent => {
                        for(let prop in data){
                            torrent[prop] = data[prop]
                        }
                        return callback(null, {torrent, data})
                    })
                }
            }
        })
    }
    publish(folder, keypair, sequence, stuff, callback){
        if(!callback){
            callback = function(){}
        }
        if((!folder || typeof(folder) !== 'string') || (!folder.includes('/') && !folder.includes('\\'))){
            return callback(new Error('must have folder'))
        } else {
            folder = {folderOld: path.resolve(folder), target: folder.split(path.sep).pop()}
            if(folder.target.includes('.')){
                folder.folderNew = storage + path.sep + keypair.address + '.' + folder.target.split('.').pop()
            } else {
                folder.folderNew = storage + path.sep + keypair.address
            }
            delete folder.target
        }
        if((!keypair) || (!keypair.address || !keypair.secret)){
            keypair = this.webproperty.createKeypair()
        }
        if(!stuff || typeof(stuff) !== 'object' || Array.isArray(stuff)){
            stuff = {}
        }
        fs.copy(folder.folderOld, folder.folderNew, {overwrite: true}, error => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.seed(folder.folderNew, {destroyStoreOnDestroy: clean}, torrent => {
                    this.webproperty.publish(keypair, {ih: torrent.infoHash, ...stuff}, sequence, (mainError, data) => {
                        if(mainError){
                            return callback(mainError)
                        } else {
                            data.infohash = data.infoHash
                            delete data.infoHash
                            const secret = data.secret
                            delete data.secret
                            for(let prop in data){
                                torrent[prop] = data[prop]
                            }
                            return callback(null, {torrent, data, secret})
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
        this.webproperty.shred(address, (resError, resProp) => {
            if(resError){
                return callback(resError)
            } else {
                let tempTorrent = this.findTheTorrent(resProp.address)
                if(tempTorrent){
                    this.webtorrent.remove(tempTorrent.infoHash, {destroyStore: clean}, error => {
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
        for(let i = 0;i < this.webtorrent.torrents.length;i++){
            if(this.webtorrent.torrents[i].address === address){
                tempTorrent = this.webtorrent.torrents[i]
                break
            }
        }
        return tempTorrent
    }
}

module.exports = TorrentProperty