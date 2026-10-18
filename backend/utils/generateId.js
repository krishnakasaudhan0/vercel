const MAXLEN=5;
const chars="abcdefghijklmnopqrstuvwxyz0123456789"
export default function generateId() {
    // const timestamp = Date.now()
    // const random = Math.floor(Math.random() * 1000)
    // return  timestamp+random
    let id =""
    for(let i=0;i<MAXLEN;i++){
        id+=chars[Math.floor(Math.random()*chars.length)]
    }
    return id
}