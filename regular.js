const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/regular.js')
const fs = require('fs')
const path = require('path')
const EventEmitter = require('events').EventEmitter

class TorrentProperty extends EventEmitter {
    constructor(opt){
        super()
        if(!opt){
            opt.storage = path.resolve(__dirname + '/storage')
            opt.takeOutInActive = false
        } else {
            if(!opt.storage){
                opt.storage = path.resolve(__dirname + '/storage')
            }
            if(!opt.takeOutInActive){
                opt.takeOutInActive = false
            }
            if(!opt.takeOutUnManaged){
                opt.takeOutUnManaged = false
            }
        }
        // this.redo = []
        this.busyAndNotReady = false
        this.storage = path.resolve(opt.storage)
        this.takeOutInActive = opt.takeOutInActive
        this.takeOutUnManaged = opt.takeOutUnManaged
        this.webtorrent = new WebTorrent({dht: {verify}})
        this.webproperty = new WebProperty({dht: this.webtorrent.dht, takeOutInActive: this.takeOutInActive})
        this.startUp()
        this.webtorrent.on('error', error => {
            this.emit('error', error)
        })
        this.webproperty.on('error', error => {
            this.emit('error', error)
        })
        this.webproperty.on('update', data => {
            this.webtorrent.remove(data.old, {destroyStore: true}, error => {
                if(error){
                    this.emit('error', error)
                    console.log(error)
                    // this.redo.push(data.old)
                }
                this.webtorrent.add(data.new.infoHash, {path: path.resolve(this.storage + path.sep + data.new.address), destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = data.new.address
                    torrent.seq = data.new.seq
                    torrent.isActive = data.new.isActive
                    torrent.own = data.new.own
                    torrent.folder = path.resolve(this.storage + path.sep + data.new.address)
                    // console.log('the following torrent has been updated: ' + torrent.address)
                    this.emit('updated', torrent)
                })
            })
        })
        if(this.takeOutInActive){
            this.webproperty.on('inactive', data => {
                this.webtorrent.remove(data.infoHash, {destroyStore: true}, error => {
                    if(error){
                        this.emit('error', error)
                        console.log(error)
                        // this.redo.push(data.infoHash)
                    } else {
                        this.emit('deactivated', data)
                    }
                })
            })
        }
        this.webproperty.on('check', data => {
            this.emit('checked', data)
        })
        this.keepThingsUpdated()
    }
    async startUp(){
        this.busyAndNotReady = true
        if(fs.existsSync(this.storage)){
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
            props = props.map(data => {return data.address})
            let hasNot = dirs.filter(data => {return !props.includes(data)})
            if(hasNot.length){
                for(let i = 0;i < hasNot.length;i++){
                    if(this.takeOutUnManaged){
                        await new Promise((resolve, reject) => {
                            fs.rm(path.resolve(this.storage + path.sep + '_' + hasNot[i]), {recursive: true, force: true}, error => {
                                if(error){
                                    reject(false)
                                } else {
                                    resolve(true)
                                }
                            })
                        })
                    } else {
                        await new Promise((resolve) => {
                            this.webtorrent.seed(path.resolve(this.storage + path.sep + '_' + hasNot[i]), {path: path.resolve(this.storage + path.sep + '_' + hasNot[i]), destroyStoreOnDestroy: true}, torrent => {
                                torrent.address = '_' + hasNot[i]
                                torrent.folder = path.resolve(this.storage + path.sep + '_' + hasNot[i])
                                torrent.unmanaged = true
                                resolve(torrent)
                            })
                        })
                    }
                }
            }
            if(has.length){
                for(let i = 0;i < has.length;i++){
                    await new Promise((resolve) => {
                        this.webtorrent.seed(path.resolve(this.storage + path.sep + has[i].address), {path: path.resolve(this.storage + path.sep + has[i].address), destroyStoreOnDestroy: true}, torrent => {
                            torrent.address = has[i].address
                            torrent.seq = has[i].seq
                            torrent.isActive = has[i].isActive
                            torrent.own = has[i].own
                            torrent.folder = path.resolve(this.storage + path.sep + has[i].address)
                            resolve(torrent)
                        })
                    })
                }
            }
        } else {
            fs.mkdirSync(this.storage, {recursive: true})
        }
        this.busyAndNotReady = false
        this.emit('started', true)
    }
    async removeUnManaged(){
        let tempTorrents = this.webtorrent.torrents.filter(data => {return data.unmanaged}).map(data => {return data.infoHash})
        for(let i = 0;i < tempTorrents.length;i++){
            await new Promise((resolve, reject) => {
                this.webtorrent.remove(tempTorrents[i], {destroyStore: true}, error => {
                    if(error){
                        console.log(error)
                        reject(error)
                    } else {
                        resolve(tempTorrents[i])
                    }
                })
            })
        }
    }
    async keepThingsUpdated(){
        if(this.takeOutUnManaged){
            await this.removeUnManaged()
        }
        setTimeout(() => {this.keepThingsUpdated()}, 3600000)
    }
    load(address, manage, callback){
        if(!callback){
            callback = function(){}
        }
        this.webproperty.resolve(this.webproperty.addressFromLink(address), manage, (error, data) => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.add(data.infoHash, {path: path.resolve(this.storage + path.sep + data.address), destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = data.address
                    torrent.seq = data.seq
                    torrent.isActive = data.isActive
                    torrent.own = data.own
                    torrent.folder = path.resolve(this.storage + path.sep + data.address)
                    return callback(null, torrent)
                })
            }
        })
    }
    publish(folder, keypair, seq, manage, callback){
        if(!callback){
            callback = function(){}
        }
        if(!folder){
            return callback(new Error('must have folder'))
        }
        if((!keypair) || (!keypair.address || !keypair.secret)){
            keypair = this.webproperty.createKeypair(null)
        }
        this.webtorrent.seed(path.resolve(folder), {path: path.resolve(this.storage + path.sep + keypair.address), destroyStoreOnDestroy: true}, torrent => {
            this.webproperty.publish(keypair, torrent.infoHash, seq, manage, (error, data) => {
                if(error){
                    this.webtorrent.remove(torrent.infoHash, {destroyStore: true})
                    return callback(error)
                } else {
                    torrent.address = data.address
                    torrent.seq = data.seq
                    torrent.isActive = data.isActive
                    torrent.own = data.own
                    torrent.folder = path.resolve(this.storage + path.sep + keypair.address)
                    return callback(null, torrent)
                }
            })
        })
    }
    remove(address, manage, callback){
        if(!callback){
            callback = function(){}
        }
        if(manage){
            this.webproperty.shred(this.webproperty.addressFromLink(address), (resError, resProp) => {
                if(resError){
                    return callback(resError)
                } else {
                    this.webtorrent.remove(resProp.data.infoHash, {destroyStore: true}, error => {
                        if(error){
                            return callback(error)
                        } else {
                            callback(null, 'torrent has been deleted')
                        }
                    })
                }
            })
        } else {
            let tempTorrent = null
            for(let i = 0;i < this.webtorrent.torrents.length;i++){
                if(this.webtorrent.torrents[i].address === address){
                    tempTorrent = this.webtorrent.torrents[i]
                    break
                }
            }
            if(tempTorrent){
                this.webtorrent.remove(tempTorrent.infoHash, {destroyStore: true}, error => {
                    if(error){
                        return callback(error)
                    } else {
                        return callback(null, 'torrent has been deleted')
                    }
                })
            } else {
                return callback(new Error('did not find torrent'))
            }
        }
    }
}

module.exports = TorrentProperty