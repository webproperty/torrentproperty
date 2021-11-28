const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/regular.js')
const fs = require('fs')
const path = require('path')
const EventEmitter = require('events').EventEmitter

class TorrentProperty extends EventEmitter {
    constructor(opt){
        super()
        if(!opt){
            opt.storage = path.resolve(__dirname + '/folder')
            opt.takeOutInActive = false
            opt.max = 0
        } else {
            if(!opt.storage){
                opt.storage = path.resolve(__dirname + '/folder')
            }
            if(!opt.takeOutInActive){
                opt.takeOutInActive = false
            }
            if(!opt.takeOutUnManaged){
                opt.takeOutUnManaged = false
            }
            if(!opt.max){
                opt.max = 0
            }
        }
        // this.redo = []
        this.storage = path.resolve(opt.storage)
        if(!fs.existsSync(this.storage)){
            fs.mkdirSync(this.storage, {recursive: true})
        }
        this.folders = (() => {
            fs.readdir(this.storage, {withFileTypes: true}, (error, data) => {
                if(error){
                    this.emit('error', error)
                    return []
                } else if(data){
                    data = data.map(datas => {return {folderPath: path.resolve(this.storage + path.sep + datas), folderName: datas, address: datas}})
                    return data
                } else if(!data){
                    this.emit('error', new Error('did not find storage folder'))
                    return []
                }
            })
        })()
        this.readyToGo = true
        this.max = opt.max
        this.takeOutInActive = opt.takeOutInActive
        this.takeOutUnManaged = opt.takeOutUnManaged
        this.webtorrent = new WebTorrent({dht: {verify}})
        this.webproperty = new WebProperty({dht: this.webtorrent.dht, takeOutInActive: this.takeOutInActive})
        this.startUp().catch(error => {
            this.emit('error', error)
        })
        this.webtorrent.on('error', error => {
            this.emit('error', error)
        })
        this.webproperty.on('error', error => {
            this.emit('error', error)
        })
        this.webproperty.on('update', data => {
            let tempData = null
            for(let i = 0;i < this.folders.length;i++){
                if(this.folders[i].address === data.address){
                    tempData = this.folders[i]
                    break
                }
            }
            if(tempData){
                tempData.infoHash = data.new.infoHash
                tempData.seq = data.new.seq
                this.emit('updated', 'data was updated')
            } else {
                this.emit('error', new Error('could not find data to update'))
            }
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
            if(data){
                this.startTheUpdate(this.webproperty.properties.map(data => {return {address: data.address, seq: data.seq, infoHash: data.infoHash, active: data.active}}))
            }
            this.emit('checked', data)
        })
        
        this.keepThingsUpdated().catch(error => {
            this.emit('error', error)
        })
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
                            this.webtorrent.seed(path.resolve(this.storage + path.sep + '_' + hasNot[i]), {destroyStoreOnDestroy: true}, torrent => {
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
                        this.webtorrent.seed(path.resolve(this.storage + path.sep + has[i].address), {destroyStoreOnDestroy: true}, torrent => {
                            torrent.address = has[i].address
                            torrent.seq = has[i].seq
                            torrent.active = has[i].active
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
        if(this.takeOutUnManaged){
            await this.removeUnManaged()
        }
        setTimeout(() => {this.keepThingsUpdated().catch(error => {this.emit('error', error)})}, 3600000)
    }

    load(address, manage, callback){
        if(!callback){
            callback = function(){}
        }
        this.webproperty.resolve(address, manage, (error, data) => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.add(data.infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = data.address
                    torrent.seq = data.seq
                    torrent.active = data.active
                    torrent.own = data.own
                    torrent.folder = path.resolve(this.storage + path.sep + data.address)
                    torrent.site = data.magnet
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
                            torrent.own = data.own
                            torrent.folder = folder.new
                            torrent.site = data.magnet
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
                                return callback(null, tempTorrent)
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