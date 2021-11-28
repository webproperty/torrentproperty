const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/managed.js')
const fs = require('fs')
const path = require('path')
const EventEmitter = require('events').EventEmitter
const { EROFS } = require('constants')

class TorrentProperty extends EventEmitter {
    constructor(opt){
        super()
        if(!opt){
            opt.storage = path.resolve('./folder')
            opt.takeOutInActive = false
        } else {
            if(!opt.storage){
                opt.storage = path.resolve('./folder')
            }
            if(!opt.takeOutInActive){
                opt.takeOutInActive = false
            }
        }
        this.busyAndNotReady = false
        this.storage = path.resolve(opt.storage)
        if(!fs.existsSync(this.storage)){
            fs.mkdirSync(this.storage, {recursive: true})
        }
        this.takeOutInActive = opt.takeOutInActive
        this.webtorrent = new WebTorrent({dht: {verify}})
        this.webproperty = new WebProperty({dht: this.webtorrent.dht, takeOutInActive: this.takeOutInActive})
        this.started = true
        this.webtorrent.on('error', error => {
            this.emit('error', error)
        })
        this.webproperty.on('error', error => {
            this.emit('error', error)
        })
        this.webproperty.on('check', data => {
            if(data){
                if(this.started){
                    this.startUp().catch(error => {
                        this.emit('error', error)
                    })
                    this.started = false
                } else {
                    this.keepItUpdated().catch(error => {
                        this.emit('error', error)
                    })
                }
            }
        })
    }

    async startUp(){
        this.busyAndNotReady = true
        this.emit('checked', false)
        for(let i = 0;i < this.webtorrent.torrents.length;i++){
            await new Promise((resolve, reject) => {
                this.webtorrent.remove(this.webtorrent.torrents[i].infoHash, {destroyStore: false}, error => {
                    if(error){
                        reject(false)
                    } else {
                        resolve(true)
                    }
                })
            })
        }
        let props = this.webproperty.getAll(null)
        let propz = props.map(data => {return data.address})
        let dirs = await new Promise((resolve, reject) => {
            fs.readdir(this.storage, {withFileTypes: true}, (error, files) => {
                if(error){
                    reject([])
                } else if(files){
                    resolve(files)
                } else if(!files){
                    reject([])
                }
            })
        })
        let hasNot = dirs.filter(data => {return !propz.includes(data)})
        if(hasNot.length){
            for(let i = 0;i < hasNot.length;i++){
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
        }
        if(props.length){
            for(let i = 0;i < props.length;i++){
                await new Promise((resolve) => {
                    this.webtorrent.add(props[i].infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                        torrent.address = props[i].address
                        torrent.seq = props[i].seq
                        torrent.active = props[i].active
                        torrent.own = props[i].own
                        torrent.site = props[i].magnet
                        torrent.folder = path.resolve(this.storage + path.sep + props[i].address)
                        resolve(torrent)
                    })
                })
            }
        }
        this.emit('checked', true)
        this.busyAndNotReady = false
    }

    async keepItUpdated(){
        this.busyAndNotReady = true
        this.emit('checked', false)
        let props = this.webproperty.getAll(null)
        let allTorrents = this.webtorrent.torrents.map(data => {return data.infoHash})
        let propz = props.map(data => {return data.infoHash})
        let dropTorrents = allTorrents.filter(data => {return !propz.includes(data)})
        // let testTorrents = allTorrents.filter(data => {return propz.includes(data)})
        let needTorrents = props.filter(data => {return !allTorrents.includes(data.infoHash)})
        let updateTorrents = props.filter(data => {return allTorrents.includes(data.infoHash)})
        for(let i = 0;i < dropTorrents.length;i++){
            await new Promise((resolve, reject) => {
                this.webtorrent.remove(dropTorrents[i], {destroyStore: true}, error => {
                    if(error){
                        this.emit('error', error)
                        reject(false)
                    } else {
                        resolve(true)
                    }
                })
            })
        }
        for(let i = 0;i < needTorrents.length;i++){
            await new Promise(resolve => {
                this.webtorrent.add(needTorrents[i].infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = needTorrents[i].address
                    torrent.seq = needTorrents[i].seq
                    torrent.own = needTorrents[i].own
                    torrent.active = needTorrents[i].active
                    torrent.site = needTorrents[i].magnet
                    torrent.folder = path.resolve(this.storage + path.sep + needTorrents[i].address)
                    resolve(torrent)
                })
            })
        }
        for(let i = 0;i < updateTorrents.length;i++){
            let tempTorrent = this.webtorrent.get(updateTorrents[i].infoHash)
            if(tempTorrent){
                tempTorrent.address = updateTorrents[i].address
                tempTorrent.seq = updateTorrents[i].seq
                tempTorrent.own = updateTorrents[i].own
                tempTorrent.active = updateTorrents[i].active
                tempTorrent.site = updateTorrents[i].magnet
                tempTorrent.folder = path.resolve(this.storage + path.sep + updateTorrents[i].address)
            } else {
                await new Promise(resolve => {
                    this.webtorrent.add(updateTorrents[i].infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                        torrent.address = updateTorrents[i].address
                        torrent.seq = updateTorrents[i].seq
                        torrent.own = updateTorrents[i].own
                        torrent.active = updateTorrents[i].active
                        torrent.site = updateTorrents[i].magnet
                        torrent.folder = path.resolve(this.storage + path.sep + updateTorrents[i].address)
                        resolve(torrent)
                    })
                })
            }
        }
        this.emit('checked', true)
        this.busyAndNotReady = false
    }
    // async startRedo(){
    //     for(let i = 0;i < this.redo.length;i++){
    //         await new Promise((resolve, reject) => {
    //             this.webtorrent.remove(this.redo[i], {destroyStore: true}, error => {
    //                 if(error){
    //                     reject(false)
    //                 } else {
    //                     resolve(true)
    //                 }
    //             })
    //         })
    //     }
    //     this.redo = []
    //     setTimeout(() => {
    //         this.startRedo()
    //     }, 3600000)
    // }
    load(address, callback){
        if(!callback){
            callback = function(){}
        }
        this.webproperty.resolve(this.webproperty.addressFromLink(address), (error, data) => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.add(data.infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = data.address
                    torrent.seq = data.seq
                    torrent.active = data.active
                    torrent.own = data.own
                    torrent.site = data.magnet
                    torrent.folder = path.resolve(this.storage + path.sep + data.address)
                    return callback(null, {torrent, data})
                })
            }
        })
    }
    publish(folder, keypair, seq, callback){
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
                    this.webproperty.publish(keypair, torrent.infoHash, seq, (error, data) => {
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
                            torrent.own = data.own
                            torrent.site = data.magnet
                            torrent.folder = folder.new
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
        this.webproperty.shred(this.webproperty.addressFromLink(address), (resError, resProp) => {
            if(resError){
                return callback(resError)
            } else {
                    // this.webtorrent.remove(resProp.infoHash, {destroyStore: true}, error => {
                    //     if(error){
                    //         return callback(error)
                    //     } else {
                    //         return callback(null, resProp)
                    //     }
                    // })
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