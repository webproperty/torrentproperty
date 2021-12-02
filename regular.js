const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/regular.js')
const fs = require('fs')
const path = require('path')
const EventEmitter = require('events').EventEmitter

class TorrentProperty extends EventEmitter {
    constructor(opt){
        super()
        if(!opt){
            opt = {}
            opt.storage = path.resolve('./folder')
            opt.takeOutInActive = false
            opt.start = {clear: true, share: true}
            opt.load = false
        } else {
            if(!opt.storage){
                opt.storage = path.resolve('./folder')
            }
            if(!opt.takeOutInActive){
                opt.takeOutInActive = false
            }
            if(!opt.takeOutUnManaged){
                opt.takeOutUnManaged = false
            }
            if(!opt.start){
                opt.start = {clear: true, share: true}
            }
            if(!opt.load){
                opt.load = false
            }
        }
        // this.redo = []
        this.storage = path.resolve(opt.storage)
        if(!fs.existsSync(this.storage)){
            fs.mkdirSync(this.storage, {recursive: true})
        }
        this.atStart = opt.start
        this.atLoad = opt.load
        this.busyAndNotReady = false
        this.takeOutInActive = opt.takeOutInActive
        this.takeOutUnManaged = opt.takeOutUnManaged
        this.webtorrent = new WebTorrent({dht: {verify}})
        this.webproperty = new WebProperty({dht: this.webtorrent.dht, takeOutInActive: this.takeOutInActive})
        this.start = true
        this.webtorrent.on('error', error => {
            this.emit('error', error)
        })
        this.webproperty.on('error', error => {
            this.emit('error', error)
        })
        this.webproperty.on('check', data => {
            if(data){
                if(this.start){
                    this.startUp().catch(error => {
                        this.emit('error', error)
                })
                this.start = false
            } else {
                this.keepThingsUpdated().catch(error => {
                    this.emit('error', error)
                })
            }
        }
        this.emit('checked', data)
    })
}

    async startUp(){
        this.busyAndNotReady = true
        this.emit('checked', false)
        if(this.atStart.clear){
            for(let i = 0;i < this.webtorrent.torrents.length;i++){
                await new Promise((resolve, reject) => {
                    this.webtorrent.remove(this.webtorrent.torrents[i].infoHash, {destroyStore: true}, error => {
                        if(error){
                            reject(false)
                        } else {
                            resolve(true)
                        }
                    })
                })
            }
        }
        let props = this.webproperty.getAll(null)
        let dirs = await new Promise((resolve, reject) => {
            fs.readdir(this.storage, {withFileTypes: false}, (error, files) => {
                if(error){
                    reject(null)
                } else if(files){
                    resolve(files)
                } else {
                    reject(null)
                }
            })
        })
        let has = props.filter(data => {return dirs.includes(data.address)})
        if(this.atStart.clear || this.atStart.share){
            props = props.map(data => {return data.address})
            let hasNot = dirs.filter(data => {return !props.includes(data)})
            if(hasNot.length){
                for(let i = 0;i < hasNot.length;i++){
                    if(this.atStart.clear){
                        await new Promise((resolve, reject) => {
                            fs.rm(path.resolve(this.storage + path.sep + hasNot[i]), {recursive: true, force: true}, error => {
                                if(error){
                                    reject(false)
                                } else {
                                    resolve(true)
                                }
                            })
                        })
                    }
                    if(this.atStart.share){
                        await new Promise((resolve) => {
                            this.webtorrent.seed(path.resolve(this.storage + path.sep + hasNot[i]), {destroyStoreOnDestroy: true}, torrent => {
                                torrent.address = hasNot[i]
                                torrent.managed = false
                                resolve(torrent)
                            })
                        })
                    }
                }
            }
        }
        if(has.length){
            for(let i = 0;i < has.length;i++){
                await new Promise((resolve) => {
                    this.webtorrent.seed(path.resolve(this.storage + path.sep + has[i].address), {destroyStoreOnDestroy: true}, torrent => {
                        torrent.address = has[i].address
                        torrent.seq = has[i].seq
                        torrent.active = has[i].active
                        torrent.signed = has[i].signed
                        torrent.magnet = has[i].magnet
                        torrent.managed = true
                        resolve(torrent)
                    })
                })
            }
        }
        this.emit('checked', true)
        this.busyAndNotReady = false
    }
    async removeUnManaged(){
        let tempTorrents = this.webtorrent.torrents.filter(data => {return !data.managed})
        for(let i = 0;i < tempTorrents.length;i++){
            await new Promise((resolve, reject) => {
                this.webtorrent.remove(tempTorrents[i].infoHash, {destroyStore: true}, error => {
                    if(error){
                        this.emit('error', error)
                        reject(error)
                    } else {
                        this.emit('dead', {address: tempTorrents[i].address, infoHash: tempTorrents[i].infoHash, seq: tempTorrents[i].seq})
                        resolve(tempTorrents[i])
                    }
                })
            })
        }
    }

    async keepThingsUpdated(){
        this.busyAndNotReady = true
        this.emit('checked', false)
        let props = this.webproperty.getAll(null)
        let allTorrents = this.webtorrent.torrents.map(data => {return data.infoHash})
        // let propz = props.map(data => {return data.infoHash})
        // let dropTorrents = allTorrents.filter(data => {return !propz.includes(data)})
        // let testTorrents = allTorrents.filter(data => {return propz.includes(data)})
        let needTorrents = props.filter(data => {return !allTorrents.includes(data.infoHash)})
        let updateTorrents = props.filter(data => {return allTorrents.includes(data.infoHash)})
        // for(let i = 0;i < dropTorrents.length;i++){
        //     await new Promise((resolve, reject) => {
        //         this.webtorrent.remove(dropTorrents[i], {destroyStore: true}, error => {
        //             if(error){
        //                 this.emit('error', error)
        //                 reject(false)
        //             } else {
        //                 resolve(true)
        //             }
        //         })
        //     })
        // }
        for(let i = 0;i < needTorrents.length;i++){
            await new Promise(resolve => {
                this.webtorrent.add(needTorrents[i].infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = needTorrents[i].address
                    torrent.seq = needTorrents[i].seq
                    torrent.active = needTorrents[i].active
                    torrent.magnet = needTorrents[i].magnet
                    torrent.signed = needTorrents[i].signed
                    torrent.managed = true
                    resolve(torrent)
                })
            })
        }
        for(let i = 0;i < updateTorrents.length;i++){
            let tempTorrent = this.webtorrent.get(updateTorrents[i].infoHash)
            if(tempTorrent){
                tempTorrent.address = updateTorrents[i].address
                tempTorrent.seq = updateTorrents[i].seq
                tempTorrent.active = updateTorrents[i].active
                tempTorrent.magnet = updateTorrents[i].magnet
                tempTorrent.signed = updateTorrents[i].signed
                tempTorrent.managed = true
            } else {
                await new Promise(resolve => {
                    this.webtorrent.add(updateTorrents[i].infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                        torrent.address = updateTorrents[i].address
                        torrent.seq = updateTorrents[i].seq
                        torrent.active = updateTorrents[i].active
                        torrent.magnet = updateTorrents[i].magnet
                        torrent.signed = updateTorrents[i].signed
                        torrent.managed = true
                        resolve(torrent)
                    })
                })
            }
        }
        this.emit('checked', true)
        this.busyAndNotReady = false
    }

    load(address, manage, callback){
        if(!callback){
            callback = function(){}
        }

        if(this.atLoad){
            let tempTorrents = this.webtorrent.torrents.filter(data => {return data.managed})
            for(let i = 0;i < tempTorrents.length;i++){
                this.webtorrent.remove(tempTorrents[i].infoHash, {destroyStore: true})
            }
        }

        this.webproperty.resolve(address, manage, (error, data) => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.add(data.infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = data.address
                    torrent.seq = data.seq
                    torrent.active = data.active
                    torrent.signed = data.signed
                    torrent.magnet = data.magnet
                    torrent.managed = manage
                    return callback(null, {torrent, data})
                })
            }
        })
    }
    publish(folder, keypair, seq, manage, callback){
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
            keypair = this.webproperty.createKeypair(null)
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
                this.webtorrent.seed(folder.new, {destroyStoreOnDestroy: true}, torrent => {
                    this.webproperty.publish(keypair, torrent.infoHash, seq, manage, (error, data) => {
                        if(error){
                            this.webtorrent.remove(torrent.infoHash, {destroyStore: true}, resError => {
                                if(resError){
                                    return callback(resError)
                                } else {
                                    return callback(error)
                                }
                            })
                        } else {
                            torrent.address = data.address
                            torrent.seq = data.seq
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
            this.webproperty.shred(address, (resError, resProp) => {
                if(resError){
                    return callback(resError)
                } else {
                    let tempTorrent = this.findTheTorrent(resProp.address)
                    if(tempTorrent){
                        this.webtorrent.remove(tempTorrent.infoHash, {destroyStore: true}, error => {
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
                this.webtorrent.remove(tempTorrent.infoHash, {destroyStore: true}, error => {
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