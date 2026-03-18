import pymongo
uri = "mongodb://cosmos-dax-dakona-pilot:uH4yWzAqgQXyy9JQghlPUp2MhbwZ1KoSbCm8oxxGoMB4Ve3lKJ34iNjYSdKPTvTqBLFUbTGqo2L4ACDbNY3Utg==@cosmos-dax-dakona-pilot.mongo.cosmos.azure.com:10255/librechat?ssl=true&replicaSet=globaldb&retrywrites=false"
c = pymongo.MongoClient(uri)
db = c['librechat']
files = list(db.files.find({}, {'_id':0,'file_id':1,'filename':1,'filepath':1,'source':1,'createdAt':1}).sort('createdAt',-1).limit(5))
for f in files:
    print(f)
