import Immutable from 'immutable';
import BigInteger from 'bigi';
import ChainTypes from './ChainTypes';
import ChainValidation from './ChainValidation';
import ee from './EmitterInstance';
import {Apis} from '../../ws';

const {ObjectType, ImplObjctType} = ChainTypes;
let emitter = ee.emitter();

let opHistory = parseInt(ObjectType.operation_history.toString(), 10);
let limitOrder = parseInt(ObjectType.limit_order.toString(), 10);
let callOrder = parseInt(ObjectType.call_order.toString(), 10);
let proposal = parseInt(ObjectType.proposal.toString(), 10);
let witnessObjectType = parseInt(ObjectType.witness.toString(), 10);
let workerObjectType = parseInt(ObjectType.worker.toString(), 10);
let committeeMemberObjectType = parseInt(ObjectType.committee_member.toString(), 10);
let accountObjectType = parseInt(ObjectType.account.toString(), 10);
let assetObjectType = parseInt(ObjectType.asset.toString(), 10);
let tournamentObjectType = parseInt(ObjectType.tournament.toString(), 10);
let tournamentDetailsObjectType = parseInt(ObjectType.tournament_details.toString(), 10);

let orderPrefix = `1.${limitOrder}.`;
let callOrderPrefix = `1.${callOrder}.`;
let proposalPrefix = `1.${proposal}.`;
let operationHistoryPrefix = `1.${opHistory}.`;
let balancePrefix = `2.${parseInt(ImplObjctType.account_balance.toString(), 10)}.`;
let accountStatsPrefix = `2.${parseInt(ImplObjctType.account_statistics.toString(), 10)}.`;
let transactionPrefix = `2.${parseInt(ImplObjctType.transaction.toString(), 10)}.`;
let accountTransactionHistoryPrefix = `2.${parseInt(ImplObjctType.account_transaction_history.toString(), 10)}.`;
let assetDynamicDataPrefix = `2.${parseInt(ImplObjctType.asset_dynamic_data.toString(), 10)}.`;
let bitassetDataPrefix = `2.${parseInt(ImplObjctType.asset_bitasset_data.toString(), 10)}.`;
let blockSummaryPrefix = `2.${parseInt(ImplObjctType.block_summary.toString(), 10)}.`;
let witnessPrefix = `1.${witnessObjectType}.`;
let workerPrefix = `1.${workerObjectType}.`;
let committeePrefix = `1.${committeeMemberObjectType}.`;
let assetPrefix = `1.${assetObjectType}.`;
let accountPrefix = `1.${accountObjectType}.`;
let tournamentPrefix = `1.${tournamentObjectType}.`;
let tournamentDetailsPrefix = `1.${tournamentDetailsObjectType}.`;

// count last operations should be stored in memory
let operationStackSize = 100;
// count last blocks should be stored in memory
let blockStackSize = 20;

let envDebug = process.env.npm_config__graphene_chain_chain_debug;
const DEBUG = envDebug ? JSON.parse(envDebug) : false;

/**
 *  @brief maintains a local cache of blockchain state
 *
 *  The ChainStore maintains a local cache of blockchain state and exposes
 *  an API that makes it easy to query objects and receive updates when
 *  objects are available.
 */
class ChainStore {
  /*
    let subscribers = {
      referral: null
    };
  */
  subscribers: Set<{referral: string | null}>;
  subscribed: boolean;
  subbedAccounts: Set<string>;
  subbedWitnesses: Set<string>;
  subbedCommittee: Set<string>;
  progress: number;
  chainTimeOffset: [];
  dispatchFrequency: number;
  objectsById: Immutable.Map<{}, {}>;
  accountsByName: Immutable.Map<{}, {}>;
  assetsBySymbol: Immutable.Map<{}, {}>;
  accountIdsByKey: Immutable.Map<{}, {}>;
  balanceObjectsByAddress: Immutable.Map<{}, {}>;
  getAccountRefsOfKeysCalls: Immutable.Set<{}>;
  eventGroupsListBySportId: Immutable.Map<{}, {}>;
  bettingMarketGroupsListBySportId: Immutable.Map<{}, {}>;
  bettingMarketsListBySportId: Immutable.Map<{}, {}>;
  accountHistoryRequests: Map<any, any>;
  witnessByAccountId: Map<any, any>;
  witnesses: Immutable.Set<{}>;
  accountByWitnessId: Map<any, any>;
  committeeByAccountId: Map<any, any>;
  objectsByVoteId: Map<any, any>;
  fetchingGetFullAccounts: Map<any, any>;
  recentOperations: Immutable.List<{}>;
  recentBlocks: Immutable.List<{}>;
  recentBlocksById: Immutable.Map<{}, {}>;
  lastProcessedBlock: null;
  simpleObjectsById: Immutable.Map<{}, {}>;
  tournamentIdsByState: Immutable.Map<{}, {}>;
  registeredTournamentIdsByPlayer: Immutable.Map<{}, {}>;
  lastTournamentId: undefined;
  storeInitialized: boolean;
  subError: Error | null;
  headBlockTimeString: null;
  dispatched: any;
  FetchChainObjects: (method: any, object_ids: any, timeout: any) => Promise<{}>;
  FetchChain: (methodName: any, objectIds: any, timeout?: number) => any;
  constructor() {
    /** tracks everyone who wants to receive updates when the cache changes */
    this.subscribers = new Set();
    this.subscribed = false;
    /*
        * Tracks specific objects such as accounts that can trigger additional
        * fetching that should only happen if we're actually interested in the account
        */
    this.subbedAccounts = new Set();
    this.subbedWitnesses = new Set();
    this.subbedCommittee = new Set();

    this.clearCache();
    this.progress = 0;
    // this.chainTimeOffset is used to estimate the blockchain time
    this.chainTimeOffset = [];
    this.dispatchFrequency = 40;
  }

  /**
   * Clears all cached state. This should be called any time the network connection is
   * reset.
   */
  clearCache() {
    this.objectsById = Immutable.Map();
    this.accountsByName = Immutable.Map();
    this.assetsBySymbol = Immutable.Map();
    this.accountIdsByKey = Immutable.Map();
    this.balanceObjectsByAddress = Immutable.Map();
    this.getAccountRefsOfKeysCalls = Immutable.Set();
    this.eventGroupsListBySportId = Immutable.Map();
    this.bettingMarketGroupsListBySportId = Immutable.Map();
    this.bettingMarketsListBySportId = Immutable.Map();
    this.accountHistoryRequests = new Map(); // /< tracks pending history requests
    this.witnessByAccountId = new Map();
    this.witnesses = Immutable.Set();
    this.accountByWitnessId = new Map();
    this.committeeByAccountId = new Map();
    this.objectsByVoteId = new Map();
    this.fetchingGetFullAccounts = new Map();
    this.recentOperations = Immutable.List();
    this.recentBlocks = Immutable.List();
    this.recentBlocksById = Immutable.Map();
    this.lastProcessedBlock = null;
    this.simpleObjectsById = Immutable.Map();

    clearTimeout(this.timeout);

    // tournamentIdsByState is a
    //   Map(account => Map(state_string => Set of tournament ids))
    // it maintains a map of tournaments a given account is allowed to participate
    // in (open-registration tournaments or tournaments they are whitelisted for).
    // the null account maps to all tournaments
    // accounts and states will not be tracked until their first access
    this.tournamentIdsByState = Immutable.Map().set(null, new Immutable.Map());

    // registered_tournaments_details_by_player is a map of
    //   Map(registered_account_id => Set of tournament details objects)
    // it only tracks tournaments which the account has registered to play in
    this.registeredTournamentIdsByPlayer = Immutable.Map();

    this.lastTournamentId = undefined;

    this.storeInitialized = false;
  }
  timeout(timeout: any) {
    throw new Error('Method not implemented.');
  }

  resetCache() {
    this.subscribed = false;
    this.subError = null;
    this.clearCache();
    this.headBlockTimeString = null;
    this.init()
      .then(() => {
        console.log('resetCache init success');
      })
      .catch((err: any) => {
        console.log('resetCache init error:', err);
      });
  }

  setDispatchFrequency(freq) {
    this.dispatchFrequency = freq;
  }

  init() {
    let reconnectCounter = 0;

    let _init = (resolve, reject) => {
      if (this.subscribed) {
        return resolve();
      }

      let dbApi = Apis.instance().db_api();

      if (!dbApi) {
        return reject(
          new Error(
            'Api not found, please initialize the api instance before calling the ChainStore'
          )
        );
      }

      return dbApi
        .exec('get_objects', [['2.1.0']])
        .then((optionalObjects) => {
          for (let i = 0, len = optionalObjects.length; i < len; i++) {
            let optionalObject = optionalObjects[i];

            if (optionalObject) {
              this._updateObject(optionalObject, true);

              let headTime = new Date(`${optionalObject.time}+00:00`).getTime();
              this.headBlockTimeString = optionalObject.time;
              this.chainTimeOffset.push(
                new Date().getTime() - ChainStore.timeStringToDate(optionalObject.time).getTime()
              );
              let now = new Date().getTime();
              let delta = (now - headTime) / 1000;
              let start = Date.parse('Sep 1, 2015');
              let progressDelta = headTime - start;
              this.progress = progressDelta / (now - start);

              if (delta < 60) {
                Apis.instance()
                  .db_api()
                  .exec('set_subscribe_callback', [this.onUpdate.bind(this), true])
                  .then(() => {
                    console.log('synced and subscribed, chainstore ready');
                    this.subscribed = true;
                    this.fetchRecentOperations();
                    this.subError = null;
                    resolve();
                  })
                  .catch((error: any) => { // TODO: what type of error is this
                    this.subscribed = false;
                    this.subError = error;
                    reject(error);
                    console.log('Error: ', error);
                  });
              } else {
                console.log('not yet synced, retrying in 1s');
                this.subscribed = false;
                reconnectCounter++;

                if (reconnectCounter > 5) {
                  this.subError = new Error(
                    'ChainStore sync error, please check your system clock'
                  );
                  return reject(this.subError);
                }

                setTimeout(_init.bind(this, resolve, reject), 1000);
              }
            } else {
              setTimeout(_init.bind(this, resolve, reject), 1000);
            }
          }
        })
        .catch((error: string | any) => {
          // in the event of an error clear the pending state for id
          console.log('!!! Chain API error', error);
          this.objectsById = this.objectsById.delete('2.1.0');
          reject(error);
        });
    };

    return Apis.instance().init_promise.then(() => new Promise(_init));
  }

  _subTo(type, id) {
    let key = `subbed_${type}`;

    if (!this[key].has(id)) {
      this[key].add(id);
    }
  }

  unSubFrom(type, id) {
    let key = `subbed_${type}`;
    this[key].delete(id);
    this.objectsById.delete(id);
  }

  _isSubbedTo(type, id) {
    let key = `subbed_${type}`;
    return this[key].has(id);
  }

  // / map from account id to objects
  onUpdate(updatedObjects) {
    let cancelledOrders = [];
    let closedCallOrders = [];

    emitter.emit('heartbeat');

    // updatedObjects is the parameter list, it should always be exactly
    // one element long.
    // The single parameter to this callback function is a vector of variants, where
    // each entry indicates one changed object.
    // If the entry is an object id, it means the object has been removed.  If it
    // is an full object, then the object is either newly-created or changed.
    for (let a = 0, len = updatedObjects.length; a < len; ++a) {
      for (let i = 0, subLen = updatedObjects[a].length; i < subLen; ++i) {
        let obj = updatedObjects[a][i];

        if (ChainValidation.is_object_id(obj)) {
          // An entry containing only an object ID means that object was removed
          // console.log("removed obj", obj);
          // Check if the object exists in the ChainStore
          let oldObj = this.objectsById.get(obj);

          if (obj.search(orderPrefix) === 0) {
            emitter.emit('cancel-order', obj);
            cancelledOrders.push(obj);

            if (!oldObj) {
              return;
            }

            let account = this.objectsById.get(oldObj.get('seller'));

            if (account && account.has('orders')) {
              let limit_orders = account.get('orders');

              if (account.get('orders').has(obj)) {
                account = account.set('orders', limit_orders.delete(obj));
                this.objectsById = this.objectsById.set(account.get('id'), account);
              }
            }
          }

          // Update nested callOrder inside account object
          if (obj.search(callOrderPrefix) === 0) {
            emitter.emit('close-call', obj);
            closedCallOrders.push(obj);

            if (!oldObj) {
              return;
            }

            let account = this.objectsById.get(oldObj.get('borrower'));

            if (account && account.has('call_orders')) {
              let call_orders = account.get('call_orders');

              if (account.get('call_orders').has(obj)) {
                account = account.set('call_orders', call_orders.delete(obj));
                this.objectsById = this.objectsById.set(account.get('id'), account);
              }
            }
          }

          // Remove the object
          this.objectsById = this.objectsById.set(obj, null);
        } else {
          this._updateObject(obj);
        }
      }
    }

    // Cancelled limit order(s), emit event for any listeners to update their state
    if (cancelledOrders.length) {
      emitter.emit('cancel-order', cancelledOrders);
    }

    // Closed call order, emit event for any listeners to update their state
    if (closedCallOrders.length) {
      emitter.emit('close-call', closedCallOrders);
    }

    this.notifySubscribers();
  }

  notifySubscribers() {
    // Dispatch at most only once every x milliseconds
    if (!this.dispatched) {
      this.dispatched = true;
      this.timeout = setTimeout(() => {
        this.dispatched = false;
        this.subscribers.forEach((callback) => callback());
      }, this.dispatchFrequency);
    }
  }

  /**
   *  Add a callback that will be called anytime any object in the cache is updated
   */
  subscribe(callback) {
    if (this.subscribers.has(callback)) {
      console.error('Subscribe callback already exists', callback);
    }

    this.subscribers.add(callback);
  }

  /**
   *  Remove a callback that was previously added via subscribe
   */
  unsubscribe(callback) {
    if (!this.subscribers.has(callback)) {
      console.error('Unsubscribe callback does not exists', callback);
    }

    this.subscribers.delete(callback);
  }

  /** Clear an object from the cache to force it to be fetched again. This may
   * be useful if a query failed the first time and the wallet has reason to believe
   * it may succeede the second time.
   */
  clearObjectCache(id) {
    this.objectsById = this.objectsById.delete(id);
  }

  /**
   * There are three states an object id could be in:
   *
   * 1. undefined       - returned if a query is pending
   * 3. defined         - return an object
   * 4. null            - query return null
   *
   */
  getObject(id, force = false) {
    if (!ChainValidation.is_object_id(id)) {
      throw Error(`argument is not an object id: ${JSON.stringify(id)}`);
    }

    let result = this.objectsById.get(id);

    if (result === undefined || force) {
      return this.fetchObject(id, force);
    }

    if (result === true) {
      return undefined;
    }

    return result;
  }

  getSimpleObjectById(id) {
    return new Promise((success, fail) => {
      if (!ChainValidation.is_object_id(id)) {
        return fail(new Error(`argument is not an object id: ${JSON.stringify(id)}`));
      }

      let result = this.simpleObjectsById.get(id);

      if (result) {
        return success(result);
      }

      Apis.instance()
        .db_api()
        .exec('get_objects', [[id]])
        .then((objects) => {
          let object = objects[0];

          if (!object) {
            return success(null);
          }

          this.simpleObjectsById = this.simpleObjectsById.set(id, object);
          success(object);
        });
    });
  }

  /**
   *  @return undefined if a query is pending
   *  @return null if id_or_symbol has been queired and does not exist
   *  @return object if the id_or_symbol exists
   */
  getAsset(id_or_symbol) {
    if (!id_or_symbol) {
      return null;
    }

    if (ChainValidation.is_object_id(id_or_symbol)) {
      let asset = this.getObject(id_or_symbol);

      if (asset && (asset.get('bitasset') && !asset.getIn(['bitasset', 'current_feed']))) {
        return undefined;
      }

      return asset;
    }

    // / TODO: verify id_or_symbol is a valid symbol name

    let asset_id = this.assetsBySymbol.get(id_or_symbol);

    if (ChainValidation.is_object_id(asset_id)) {
      let asset = this.getObject(asset_id);

      if (asset && (asset.get('bitasset') && !asset.getIn(['bitasset', 'current_feed']))) {
        return undefined;
      }

      return asset;
    }

    if (asset_id === null) {
      return null;
    }

    if (asset_id === true) {
      return undefined;
    }

    Apis.instance()
      .db_api()
      .exec('lookup_asset_symbols', [[id_or_symbol]])
      .then((asset_objects) => {
        if (asset_objects.length && asset_objects[0]) {
          this._updateObject(asset_objects[0], true);
        } else {
          this.assetsBySymbol = this.assetsBySymbol.set(id_or_symbol, null);
          this.notifySubscribers();
        }
      })
      .catch((error) => {
        console.log('Error: ', error);
        this.assetsBySymbol = this.assetsBySymbol.delete(id_or_symbol);
      });

    return undefined;
  }

  /**
   *  @param the public key to find accounts that reference it
   *
   *  @return Set of account ids that reference the given key
   *  @return a empty Set if no items are found
   *  @return undefined if the result is unknown
   *
   *  If this method returns undefined, then it will send a request to
   *  the server for the current set of accounts after which the
   *  server will notify us of any accounts that reference these keys
   */
  getAccountRefsOfKey(key) {
    if (this.getAccountRefsOfKeysCalls.has(key)) {
      return this.accountIdsByKey.get(key);
    }

    this.getAccountRefsOfKeysCalls = this.getAccountRefsOfKeysCalls.add(key);
    Apis.instance()
      .db_api()
      .exec('get_key_references', [[key]])
      .then(
        (vec_account_id) => {
          let refs = Immutable.Set();
          vec_account_id = vec_account_id[0];
          refs = refs.withMutations((r) => {
            for (let i = 0; i < vec_account_id.length; ++i) {
              r.add(vec_account_id[i]);
            }
          });
          this.accountIdsByKey = this.accountIdsByKey.set(key, refs);
          this.notifySubscribers();
        },
        () => {
          this.accountIdsByKey = this.accountIdsByKey.delete(key);
          this.getAccountRefsOfKeysCalls = this.getAccountRefsOfKeysCalls.delete(key);
        }
      );
    return undefined;
  }

  /**
   * @return a Set of balance ids that are claimable with the given address
   * @return undefined if a query is pending and the set is not known at this time
   * @return a empty Set if no items are found
   *
   * If this method returns undefined, then it will send a request to the server for
   * the current state after which it will be subscribed to changes to this set.
   */
  getBalanceObjects(address) {
    let current = this.balanceObjectsByAddress.get(address);

    if (current === undefined) {
      /** because balance objects are simply part of the genesis state
       * there is no need to worry about having to update them / merge
       * them or index them in updateObject.
       */
      this.balanceObjectsByAddress = this.balanceObjectsByAddress.set(
        address,
        Immutable.Set()
      );
      Apis.instance()
        .db_api()
        .exec('get_balance_objects', [[address]])
        .then(
          (balance_objects) => {
            let set = new Set();

            for (let i = 0; i < balance_objects.length; ++i) {
              this._updateObject(balance_objects[i]);
              set.add(balance_objects[i].id);
            }

            this.balanceObjectsByAddress = this.balanceObjectsByAddress.set(
              address,
              Immutable.Set(set)
            );
            this.notifySubscribers();
          },
          () => {
            this.balanceObjectsByAddress = this.balanceObjectsByAddress.delete(address);
          }
        );
    }

    return this.balanceObjectsByAddress.get(address);
  }

  /**
   * @return a list of tournament ids for upcoming tournaments
   * @return an empty list if a query is pending and the set is not known at this time
   *         or if there are no upcoming touraments
   *
   * If we have not yet requested tournaments for this account, it will
   * send a request to the server for the current list, after which it
   * will be subscribed to changes to this set.
   */
  getTournamentIdsInState(accountId, stateString) {
    let tournamentIdsForThisAccountAndState;
    let tournamentIdsForThisAccount = this.tournamentIdsByState.get(accountId);

    if (tournamentIdsForThisAccount === undefined) {
      tournamentIdsForThisAccountAndState = new Immutable.Set();
      tournamentIdsForThisAccount = new Immutable.Map().set(
        stateString,
        tournamentIdsForThisAccountAndState
      );
      this.tournamentIdsByState = this.tournamentIdsByState.set(
        accountId,
        tournamentIdsForThisAccount
      );
    } else {
      tournamentIdsForThisAccountAndState = tournamentIdsForThisAccount.get(stateString);

      if (tournamentIdsForThisAccountAndState !== undefined) {
        return tournamentIdsForThisAccountAndState;
      }

      tournamentIdsForThisAccountAndState = new Immutable.Set();
      tournamentIdsForThisAccount = tournamentIdsForThisAccount.set(
        stateString,
        tournamentIdsForThisAccountAndState
      );
      this.tournamentIdsByState = this.tournamentIdsByState.set(
        accountId,
        tournamentIdsForThisAccount
      );
    }

    Apis.instance()
      .db_api()
      .exec('get_tournaments_in_state', [stateString, 100])
      .then((tournaments) => {
        let originalTournamentIdsInState = this.tournamentIdsByState.getIn([
          accountId,
          stateString
        ]);
        // call updateObject on each tournament, which will classify it
        tournaments.forEach((tournament) => {
          /**
           * Fix bug: we cant update tournamentIdsByState if objectsById has a tournament
           */
          if (!originalTournamentIdsInState.get(tournament.id)) {
            this.clearObjectCache(tournament.id);
          }

          this._updateObject(tournament);
        });

        let tournament_id = this.tournamentIdsByState.getIn([accountId, stateString]);

        if (tournament_id !== originalTournamentIdsInState) {
          this.notifySubscribers();
        }
      });
    return tournamentIdsForThisAccountAndState;
  }

  getRegisteredTournamentIds(accountId) {
    let tournamentIds = this.registeredTournamentIdsByPlayer.get(accountId);

    if (tournamentIds !== undefined) {
      return tournamentIds;
    }

    tournamentIds = new Immutable.Set();
    this.registeredTournamentIdsByPlayer = this.registeredTournamentIdsByPlayer.set(
      accountId,
      tournamentIds
    );

    Apis.instance()
      .db_api()
      .exec('get_registered_tournaments', [accountId, 100])
      .then((registered_tournaments) => {
        let originalTournamentIds = this.registeredTournamentIdsByPlayer.get(accountId);
        let newTournamentIds = new Immutable.Set(registered_tournaments);

        if (!originalTournamentIds.equals(newTournamentIds)) {
          this.registeredTournamentIdsByPlayer = this.registeredTournamentIdsByPlayer.set(
            accountId,
            newTournamentIds
          );
          this.notifySubscribers();
        }
      });

    return tournamentIds;
  }

  /**
   *  If there is not already a pending request to fetch this object, a new
   *  request will be made.
   *
   *  @return null if the object does not exist,
   *  @return undefined if the object might exist but is not in cache
   *  @return the object if it does exist and is in our cache
   */
  fetchObject(id, force = false) {
    if (typeof id !== 'string') {
      let result = [];

      for (let i = 0; i < id.length; ++i) {
        result.push(this.fetchObject(id[i]));
      }

      return result;
    }

    if (DEBUG) {
      console.log('!!! fetchObject: ', id, this.subscribed, !this.subscribed && !force);
    }

    if (!this.subscribed && !force) {
      return undefined;
    }

    if (DEBUG) {
      console.log('maybe fetch object: ', id);
    }

    if (!ChainValidation.is_object_id(id)) {
      throw Error(`argument is not an object id: ${id}`);
    }

    if (id.substring(0, 4) === '1.2.') {
      return this.fetchFullAccount(id);
    }

    if (id.search(witnessPrefix) === 0) {
      this._subTo('witnesses', id);
    }

    if (id.search(committeePrefix) === 0) {
      this._subTo('committee', id);
    }

    let result = this.objectsById.get(id);

    if (result === undefined) {
      // the fetch
      if (DEBUG) {
        console.log('fetching object: ', id);
      }

      this.objectsById = this.objectsById.set(id, true);
      Apis.instance()
        .db_api()
        .exec('get_objects', [[id]])
        .then((optionalObjects) => {
          for (let i = 0; i < optionalObjects.length; i++) {
            let optionalObject = optionalObjects[i];

            if (optionalObject) {
              this._updateObject(optionalObject, true);
              this.simpleObjectsById = this.simpleObjectsById.set(id, optionalObject);
            } else {
              this.objectsById = this.objectsById.set(id, null);
              this.notifySubscribers();
            }
          }
        })
        .catch((error) => {
          // in the event of an error clear the pending state for id
          console.log('!!! Chain API error', error);
          this.objectsById = this.objectsById.delete(id);
        });
    } else if (result === true) {
      // then we are waiting a response
      return undefined;
    }

    return result; // we have a response, return it
  }

  /**
   *  @return null if no such account exists
   *  @return undefined if such an account may exist,
   *  and fetch the the full account if not already pending
   *  @return the account object if it does exist
   */
  getAccount(name_or_id) {
    if (!name_or_id) {
      return null;
    }

    if (typeof name_or_id === 'object') {
      if (name_or_id.id) {
        return this.getAccount(name_or_id.id);
      }

      if (name_or_id.get) {
        return this.getAccount(name_or_id.get('id'));
      }

      return undefined;
    }

    if (ChainValidation.is_object_id(name_or_id)) {
      let account = this.getObject(name_or_id);

      if (account === null) {
        return null;
      }

      if (account === undefined || account.get('name') === undefined) {
        return this.fetchFullAccount(name_or_id);
      }

      return account;
    }

    if (ChainValidation.is_account_name(name_or_id, true)) {
      let account_id = this.accountsByName.get(name_or_id);

      if (account_id === null) {
        return null; // already fetched and it wasn't found
      }

      if (account_id === undefined) {
        // then no query, fetch it
        return this.fetchFullAccount(name_or_id);
      }

      return this.getObject(account_id); // return it
    }
    // throw Error( `Argument is not an account name or id: ${name_or_id}` )
  }

  /**
   * This method will attempt to lookup witness by account_id.
   * If witness doesn't exist it will return null,
   * if witness is found it will return witness object,
   * if it's not fetched yet it will return undefined.
   * @param account_id - account id
   */
  getWitnessById(account_id) {
    let witness_id = this.witnessByAccountId.get(account_id);

    if (witness_id === undefined) {
      this.fetchWitnessByAccount(account_id);
      return undefined;
    }

    if (witness_id) {
      this._subTo('witnesses', witness_id);
    }

    return witness_id ? this.getObject(witness_id) : null;
  }

  /**
   * This method will attempt to lookup witness by account_id.
   * If witness doesn't exist it will return null,
   * if witness is found it will return witness object,
   * if it's not fetched yet it will return undefined.
   * @param witness_id - witness id
   */
  getWitnessAccount(witness_id) {
    return new Promise((success) => {
      let account = this.accountByWitnessId.get(witness_id);

      if (account) {
        return success(account);
      }

      this.getSimpleObjectById(witness_id).then((witness) => {
        this.getSimpleObjectById(witness.witness_account).then((fetched_account) => {
          this.accountByWitnessId = this.accountByWitnessId.set(witness_id, fetched_account);
          success(fetched_account);
        });
      });
    });
  }

  /**
   * This method will attempt to lookup committee member by account_id.
   * If committee member doesn't exist it will return null,
   * if committee member is found it will return committee member object,
   * if it's not fetched yet it will return undefined.
   * @param account_id - account id
   */
  getCommitteeMemberById(account_id) {
    let cm_id = this.committeeByAccountId.get(account_id);

    if (cm_id === undefined) {
      this.fetchCommitteeMemberByAccount(account_id);
      return undefined;
    }

    if (cm_id) {
      this._subTo('committee', cm_id);
    }

    return cm_id ? this.getObject(cm_id) : null;
  }

  /**
   * Obsolete! Please use getWitnessById
   * This method will attempt to lookup the account, and then query to see whether or not there is
   * a witness for this account. If the answer is known, it will return the witness_object,
   * otherwise it will attempt to look it up and return null. Once the lookup has completed
   * on_update will be called.
   *
   * @param id_or_account may either be an account_id, a witness_id, or an account_name
   */
  getWitness(id_or_account) {
    console.log('DEPRECATED call to getWitness, use getWitnessById instead.');
    let account = this.getAccount(id_or_account);

    if (!account) {
      return null;
    }

    let account_id = account.get('id');

    let witness_id = this.witnessByAccountId.get(account_id);

    if (witness_id === undefined) {
      this.fetchWitnessByAccount(account_id);
    }

    return this.getObject(witness_id);
  }

  // Obsolete! Please use getCommitteeMemberById
  getCommitteeMember(id_or_account, on_update = null) {
    console.log('DEPRECATED call to getCommitteeMember, use getCommitteeMemberById instead.');

    let is_account = ChainValidation.is_account_name(id_or_account, true);

    if (is_account || id_or_account.substring(0, 4) === '1.2.') {
      let account = this.getAccount(id_or_account);

      if (!account) {
        this.lookupAccountByName(id_or_account).then(
          (lookup_account) => {
            let account_id = lookup_account.get('id');
            let committee_id = this.committeeByAccountId.get(account_id);

            if (ChainValidation.is_object_id(committee_id)) {
              return this.getObject(committee_id, on_update);
            }

            if (committee_id === undefined) {
              this.fetchCommitteeMemberByAccount(account_id).then((committee) => {
                this.committeeByAccountId.set(
                  account_id,
                  committee ? committee.get('id') : null
                );

                if (on_update && committee) {
                  on_update();
                }
              });
            }
          },
          () => {
            this.committeeByAccountId.set(id_or_account, null);
          }
        );
      } else {
        let account_id = account.get('id');
        let committee_id = this.committeeByAccountId.get(account_id);

        if (ChainValidation.is_object_id(committee_id)) {
          return this.getObject(committee_id, on_update);
        }

        if (committee_id === undefined) {
          this.fetchCommitteeMemberByAccount(account_id).then((committee) => {
            this.committeeByAccountId.set(account_id, committee ? committee.get('id') : null);

            if (on_update && committee) {
              on_update();
            }
          });
        }
      }
    }

    return null;
  }
  lookupAccountByName(id_or_account: any) {
    throw new Error('Method not implemented.');
  }

  /**
   *
   * @returns promise with a list of all witness ids, active or not.
   * @memberof ChainStore
   */
  fetchWitnessAccounts() {
    return new Promise((resolve, reject) => {
      Apis.instance().db_api().exec('lookup_witness_accounts', [0, 1000]).then((w) => {
        if (w) {
          let witnessArr = [];
          let tmpObj = {};

          for (let i = 0, length = w.length; i < length; i++) {
            witnessArr.push(w[i][1]); // ids only

            if (tmpObj[w[i][0]] !== undefined) {
              tmpObj[w[i][0]].name = w[i][0];
              tmpObj[w[i][0]].id = w[i][1];
            } else {
              tmpObj.name = w[i][0];
              tmpObj.id = w[i][1];
            }
          }

          this.witnesses = this.witnesses.merge(witnessArr);
          this._updateObject(tmpObj, true);
          resolve(this.witnesses);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   *
   * @return a promise with the witness object
   */
  fetchWitnessByAccount(account_id) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .db_api()
        .exec('get_witness_by_account', [account_id])
        .then((optional_witness_object) => {
          if (optional_witness_object) {
            this._subTo('witnesses', optional_witness_object.id);
            this.witnessByAccountId = this.witnessByAccountId.set(
              optional_witness_object.witness_account,
              optional_witness_object.id
            );
            let witness_object = this._updateObject(optional_witness_object, true);
            resolve(witness_object);
          } else {
            this.witnessByAccountId = this.witnessByAccountId.set(account_id, null);
            this.notifySubscribers();
            resolve(null);
          }
        }, reject);
    });
  }

  /**
   *
   * @return a promise with the witness object
   */
  fetchCommitteeMemberByAccount(account_id) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .db_api()
        .exec('get_committee_member_by_account', [account_id])
        .then((optional_committee_object) => {
          if (optional_committee_object) {
            this._subTo('committee', optional_committee_object.id);
            this.committeeByAccountId = this.committeeByAccountId.set(
              optional_committee_object.committee_member_account,
              optional_committee_object.id
            );
            let committee_object = this._updateObject(optional_committee_object, true);
            resolve(committee_object);
          } else {
            this.committeeByAccountId = this.committeeByAccountId.set(account_id, null);
            this.notifySubscribers();
            resolve(null);
          }
        }, reject);
    });
  }

  /**
   *  Fetches an account and all of its associated data in a single query
   *
   *  @param an account name or account id
   *
   *  @return undefined if the account in question is in the process of being fetched
   *  @return the object if it has already been fetched
   *  @return null if the object has been queried and was not found
   */
  fetchFullAccount(name_or_id) {
    if (DEBUG) {
      console.log('Fetch full account: ', name_or_id);
    }

    let fetch_account = false;

    if (ChainValidation.is_object_id(name_or_id)) {
      let current = this.objectsById.get(name_or_id);
      fetch_account = current === undefined;

      if (!fetch_account && fetch_account.get('name')) {
        return current;
      }
    } else {
      if (!ChainValidation.is_account_name(name_or_id, true)) {
        throw Error(`argument is not an account name: ${name_or_id}`);
      }

      let account_id = this.accountsByName.get(name_or_id);

      if (ChainValidation.is_object_id(account_id)) {
        return this.getAccount(account_id);
      }
    }

    // / only fetch once every 5 seconds if it wasn't found
    if (
      !this.fetchingGetFullAccounts.has(name_or_id)
      || Date.now() - this.fetchingGetFullAccounts.get(name_or_id) > 5000
    ) {
      this.fetchingGetFullAccounts.set(name_or_id, Date.now());
      // console.log( "FETCHING FULL ACCOUNT: ", name_or_id )
      Apis.instance()
        .db_api()
        .exec('get_full_accounts', [[name_or_id], true])
        .then(
          (results) => {
            if (results.length === 0) {
              if (ChainValidation.is_object_id(name_or_id)) {
                this.objectsById = this.objectsById.set(name_or_id, null);
                this.notifySubscribers();
              }

              return;
            }

            let full_account = results[0][1];

            if (DEBUG) {
              console.log('full_account: ', full_account);
            }

            this._subTo('accounts', full_account.account.id);

            let {
              account,
              vesting_balances,
              pending_dividend_payments,
              statistics,
              call_orders,
              limit_orders,
              referrer_name,
              registrar_name,
              lifetime_referrer_name,
              votes,
              proposals
            } = full_account;

            this.accountsByName = this.accountsByName.set(account.name, account.id);
            account.referrer_name = referrer_name;
            account.lifetime_referrer_name = lifetime_referrer_name;
            account.registrar_name = registrar_name;
            account.balances = {};
            account.orders = new Immutable.Set();
            account.vesting_balances = new Immutable.Set();
            account.pending_dividend_payments = new Immutable.Set();
            account.balances = new Immutable.Map();
            account.call_orders = new Immutable.Set();
            account.proposals = new Immutable.Set();
            account.vesting_balances = account.vesting_balances.withMutations((set) => {
              vesting_balances.forEach((vb) => {
                this._updateObject(vb);
                set.add(vb.id);
              });
            });

            let sub_to_objects = [];

            votes.forEach((v) => this._updateObject(v));

            account.balances = account.balances.withMutations((map) => {
              full_account.balances.forEach((b) => {
                this._updateObject(b);
                map.set(b.asset_type, b.id);
                sub_to_objects.push(b.id);
              });
            });

            account.orders = account.orders.withMutations((set) => {
              limit_orders.forEach((order) => {
                this._updateObject(order);
                set.add(order.id);
                sub_to_objects.push(order.id);
              });
            });

            account.pending_dividend_payments = account.pending_dividend_payments.withMutations(
              (set) => {
                pending_dividend_payments.forEach((payments) => {
                  this._updateObject(payments);
                  set.add(payments);
                  sub_to_objects.push(payments.id);
                });
              }
            );

            account.call_orders = account.call_orders.withMutations((set) => {
              call_orders.forEach((co) => {
                this._updateObject(co);
                set.add(co.id);
                sub_to_objects.push(co.id);
              });
            });

            account.proposals = account.proposals.withMutations((set) => {
              proposals.forEach((p) => {
                this._updateObject(p);
                set.add(p.id);
                sub_to_objects.push(p.id);
              });
            });

            if (sub_to_objects.length) {
              Apis.instance()
                .db_api()
                .exec('get_objects', [sub_to_objects]);
            }

            this._updateObject(statistics);
            let updated_account = this._updateObject(account);
            this.fetchRecentHistory(updated_account);
            this.notifySubscribers();
          },
          (error) => {
            console.log('Error: ', error);

            if (ChainValidation.is_object_id(name_or_id)) {
              this.objectsById = this.objectsById.delete(name_or_id);
            } else {
              this.accountsByName = this.accountsByName.delete(name_or_id);
            }
          }
        );
    }

    return undefined;
  }

  static getAccountMemberStatus(account) {
    if (account === undefined) {
      return undefined;
    }

    if (account === null) {
      return 'unknown';
    }

    if (account.get('lifetime_referrer') === account.get('id')) {
      return 'lifetime';
    }

    let exp = new Date(account.get('membership_expiration_date')).getTime();
    let now = new Date().getTime();

    if (exp < now) {
      return 'basic';
    }

    return 'annual';
  }

  getAccountBalance(account, asset_type) {
    let balances = account.get('balances');

    if (!balances) {
      return 0;
    }

    let balance_obj_id = balances.get(asset_type);

    if (balance_obj_id) {
      let bal_obj = this.objectsById.get(balance_obj_id);

      if (bal_obj) {
        return bal_obj.get('balance');
      }
    }

    return 0;
  }

  /**
   * There are two ways to extend the account history, add new more
   * recent history, and extend historic hstory. This method will fetch
   * the most recent account history and prepend it to the list of
   * historic operations.
   *
   *  @param account immutable account object
   *  @return a promise with the account history
   */
  fetchRecentHistory(account, limit = 100) {
    let account_id = account;

    if (!ChainValidation.is_object_id(account_id) && account.toJS) {
      account_id = account.get('id');
    }

    if (!ChainValidation.is_object_id(account_id)) {
      return;
    }

    account = this.objectsById.get(account_id);

    if (!account) {
      return;
    }

    let pending_request = this.accountHistoryRequests.get(account_id);

    if (pending_request) {
      pending_request.requests++;
      return pending_request.promise;
    }

    pending_request = {requests: 0};

    let most_recent = `1.${opHistory}.0`;
    let history = account.get('history');

    if (history && history.size) {
      most_recent = history.first().get('id');
    }

    // / starting at 0 means start at NOW, set this to something other than 0
    // / to skip recent transactions and fetch the tail
    let start = `1.${opHistory}.0`;

    pending_request.promise = new Promise((resolve, reject) => {
      Apis.instance()
        .history_api()
        .exec('get_account_history', [account_id, most_recent, limit, start])
        .then((operations) => {
          let current_account = this.objectsById.get(account_id);
          let current_history = current_account.get('history');

          if (!current_history) {
            current_history = Immutable.List();
          }

          let updated_history = Immutable.fromJS(operations);
          updated_history = updated_history.withMutations((list) => {
            for (let i = 0; i < current_history.size; ++i) {
              list.push(current_history.get(i));
            }
          });
          let updated_account = current_account.set('history', updated_history);
          this.objectsById = this.objectsById.set(account_id, updated_account);

          let request = this.accountHistoryRequests.get(account_id);
          this.accountHistoryRequests.delete(account_id);

          if (request.requests > 0) {
            // it looks like some more history may have come in while we were
            // waiting on the result, lets fetch anything new before we resolve
            // this query.
            this.fetchRecentHistory(updated_account, limit).then(resolve, reject);
          } else {
            resolve(updated_account);
          }
        }); // end then
    });

    this.accountHistoryRequests.set(account_id, pending_request);
    return pending_request.promise;
  }

  /**
   * @brief Get a list of all sports
   */

  static getSportsList() {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .db_api()
        .exec('list_sports', [])
        .then((sportsList) => {
          if (sportsList) {
            resolve(sportsList);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  /**
   * @brief Return a list of all event groups for a sport (e.g. all soccer leagues in soccer)
   */

  getEventGroupsList(sportId) {
    let eventGroupsList = this.eventGroupsListBySportId.get(sportId);

    if (eventGroupsList === undefined) {
      this.eventGroupsListBySportId = this.eventGroupsListBySportId.set(
        sportId,
        Immutable.Set()
      );

      Apis.instance()
        .db_api()
        .exec('list_event_groups', [sportId])
        .then(
          (eventGroups) => {
            let set = new Set();

            for (let i = 0, len = eventGroups.length; i < len; ++i) {
              set.add(eventGroups[i]);
            }

            this.eventGroupsListBySportId = this.eventGroupsListBySportId.set(
              sportId,
              Immutable.Set(set)
            );
            this.notifySubscribers();
          },
          () => {
            this.eventGroupsListBySportId = this.eventGroupsListBySportId.delete(sportId);
          }
        );
    }

    return this.eventGroupsListBySportId.get(sportId);
  }

  /**
   * @brief Return a list of all betting market groups for an event
   */

  getBettingMarketGroupsList(eventId) {
    let bettingMarketGroupsList = this.bettingMarketGroupsListBySportId.get(eventId);

    if (bettingMarketGroupsList === undefined) {
      this.bettingMarketGroupsListBySportId = this.bettingMarketGroupsListBySportId.set(
        eventId,
        Immutable.Set()
      );

      Apis.instance()
        .db_api()
        .exec('list_betting_market_groups', [eventId])
        .then(
          (bettingMarketGroups) => {
            let set = new Set();

            for (let i = 0, len = bettingMarketGroups.length; i < len; ++i) {
              set.add(bettingMarketGroups[i]);
            }

            this.bettingMarketGroupsListBySportId = this.bettingMarketGroupsListBySportId.set( // eslint-disable-line
              eventId,
              Immutable.Set(set)
            );
            this.notifySubscribers();
          },
          () => {
            this.bettingMarketGroupsListBySportId = this.bettingMarketGroupsListBySportId.delete( // eslint-disable-line
              eventId
            );
          }
        );
    }

    return this.bettingMarketGroupsListBySportId.get(eventId);
  }

  /**
   * @brief Return a list of all betting markets for a betting market group
   */

  getBettingMarketsList(bettingMarketGroupId) {
    let bettingMarketsList = this.bettingMarketsListBySportId.get(bettingMarketGroupId);

    if (bettingMarketsList === undefined) {
      this.bettingMarketsListBySportId = this.bettingMarketsListBySportId.set(
        bettingMarketGroupId,
        Immutable.Set()
      );

      Apis.instance()
        .db_api()
        .exec('list_betting_markets', [bettingMarketGroupId])
        .then(
          (bettingMarkets) => {
            let set = new Set();

            for (let i = 0, len = bettingMarkets.length; i < len; ++i) {
              set.add(bettingMarkets[i]);
            }

            this.bettingMarketsListBySportId = this.bettingMarketsListBySportId.set(
              bettingMarketGroupId,
              Immutable.Set(set)
            );
            this.notifySubscribers();
          },
          () => {
            this.bettingMarketsListBySportId = this.bettingMarketsListBySportId.delete(
              bettingMarketGroupId
            );
          }
        );
    }

    return this.bettingMarketsListBySportId.get(bettingMarketGroupId);
  }

  /**
   * @brief Get global betting statistics
   */

  static getGlobalBettingStatistics() {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .db_api()
        .exec('get_global_betting_statistics', [])
        .then((getGlobalBettingStatistics) => {
          if (getGlobalBettingStatistics) {
            resolve(getGlobalBettingStatistics);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  static getBinnedOrderBook(betting_market_id, precision) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .bookie_api()
        .exec('get_binned_order_book', [betting_market_id, precision])
        .then((order_book_object) => {
          if (order_book_object) {
            resolve(order_book_object);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  static getTotalMatchedBetAmountForBettingMarketGroup(group_id) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .bookie_api()
        .exec('get_total_matched_bet_amount_for_betting_market_group', [group_id])
        .then((total_matched_bet_amount) => {
          if (total_matched_bet_amount) {
            resolve(total_matched_bet_amount);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  static getEventsContainingSubString(sub_string, language) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .bookie_api()
        .exec('get_events_containing_sub_string', [sub_string, language])
        .then((events_containing_sub_string) => {
          if (events_containing_sub_string) {
            resolve(events_containing_sub_string);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  static getUnmatchedBetsForBettor(betting_market_id_type, account_id_type) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .db_api()
        .exec('get_unmatched_bets_for_bettor', [betting_market_id_type, account_id_type])
        .then((unmatched_bets_for_bettor) => {
          if (unmatched_bets_for_bettor) {
            resolve(unmatched_bets_for_bettor);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  static listEventsInGroup(event_group_id) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .db_api()
        .exec('list_events_in_group', [event_group_id])
        .then((events_in_group) => {
          if (events_in_group) {
            resolve(events_in_group);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  static getAllUnmatchedBetsForBettor(account_id_type) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .db_api()
        .exec('get_all_unmatched_bets_for_bettor', [account_id_type])
        .then((all_unmatched_bets_for_bettor) => {
          if (all_unmatched_bets_for_bettor) {
            resolve(all_unmatched_bets_for_bettor);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  static getMatchedBetsForBettor(bettor_id) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .bookie_api()
        .exec('get_matched_bets_for_bettor', [bettor_id])
        .then((matched_bets_for_bettor) => {
          if (matched_bets_for_bettor) {
            resolve(matched_bets_for_bettor);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  static getAllMatchedBetsForBettor(bettor_id, start, limit = 1000) {
    return new Promise((resolve, reject) => {
      Apis.instance()
        .bookie_api()
        .exec('get_all_matched_bets_for_bettor', [bettor_id, start, limit])
        .then((all_matched_bets_for_bettor) => {
          if (all_matched_bets_for_bettor) {
            resolve(all_matched_bets_for_bettor);
          } else {
            resolve(null);
          }
        }, reject);
    });
  }

  /**
   *  Updates the object in place by only merging the set
   *  properties of object.
   *
   *  This method will create an immutable object with the given ID if
   *  it does not already exist.
   *
   *  This is a "private" method called when data is received from the
   *  server and should not be used by others.
   *
   *  @pre object.id must be a valid object ID
   *  @return an Immutable constructed from object and deep merged with the current state
   */
  _updateObject(object, notify_subscribers = false, emit = true) {
    if (!('id' in object)) {
      console.log('object with no id:', object);

      if ('balance' in object && 'owner' in object && 'settlement_date' in object) {
        // Settle order object
        emitter.emit('settle-order-update', object);
      }

      return;
    }

    let objectSpace = object.id.split('.').slice(0, -1);
    objectSpace.push(null); // Push an empty element into the array to take up the id space.
    objectSpace = objectSpace.join('.');

    /*
    * A lot of objects get spammed by the API that we don't care about, filter these out here
    */
    // Transaction object
    if (objectSpace === transactionPrefix) {
      return; // console.log("not interested in transaction:", object);
    }

    if (objectSpace === accountTransactionHistoryPrefix) {
      // transaction_history object
      if (!this._isSubbedTo('accounts', object.account)) {
        return; // console.log("not interested in transaction_history of", object.account);
      }
    } else if (objectSpace === orderPrefix) {
      // limitOrder object
      if (!this._isSubbedTo('accounts', object.seller)) {
        return; // console.log("not interested in limit_orders of", object.seller);
      }
    } else if (objectSpace === callOrderPrefix) {
      // callOrder object
      if (!this._isSubbedTo('accounts', object.borrower)) {
        return; // console.log("not interested in call_orders of", object.borrower);
      }
    } else if (objectSpace === balancePrefix) {
      // balance object
      if (!this._isSubbedTo('accounts', object.owner)) {
        return; // console.log("not interested in balance_object of", object.owner);
      }
    } else if (objectSpace === operationHistoryPrefix) {
      // operation_history object
      return; // console.log("not interested in operation_history", object);
    } else if (objectSpace === blockSummaryPrefix) {
      // block_summary object
      return; // console.log("not interested in block_summary_prefix", object);
    } else if (objectSpace === accountStatsPrefix) {
      // account_stats object
      if (!this._isSubbedTo('accounts', object.owner)) {
        return; // console.log("not interested in stats of", object.owner);
      }
    } else if (objectSpace === witnessPrefix) {
      // witness object
      if (!this._isSubbedTo('witnesses', object.id)) {
        return;
      }
    } else if (objectSpace === committeePrefix) {
      // committee_member object
      if (!this._isSubbedTo('committee', object.id)) {
        return;
      }
    }

    // DYNAMIC GLOBAL OBJECT
    if (object.id === '2.1.0') {
      object.participation = 100 * (BigInteger(object.recent_slots_filled).bitCount() / 128.0);
      this.headBlockTimeString = object.time;
      this.chainTimeOffset.push(Date.now() - ChainStore.timeStringToDate(object.time).getTime());

      if (this.chainTimeOffset.length > 10) {
        this.chainTimeOffset.shift(); // remove first
      }

      this.fetchRecentOperations(object.head_block_number);
    }

    let current = this.objectsById.get(object.id, undefined);

    if (current === undefined || current === true) {
      current = Immutable.Map();
    }

    let prior = current;

    if (current === undefined || current === true) {
      this.objectsById = this.objectsById.set(object.id, (current = Immutable.fromJS(object)));
    } else {
      this.objectsById = this.objectsById.set(
        object.id,
        (current = current.mergeDeep(Immutable.fromJS(object)))
      );
    }

    // BALANCE OBJECT
    if (objectSpace === balancePrefix) {
      let owner = this.objectsById.get(object.owner);

      if (owner === undefined || owner === null) {
        return;
        /*  This prevents the full account from being looked up later
            owner = {id:object.owner, balances:{ } }
            owner.balances[object.asset_type] = object.id
            owner = Immutable.fromJS( owner )
            */
      }

      let balances = owner.get('balances');

      if (!balances) {
        owner = owner.set('balances', Immutable.Map());
      }

      owner = owner.setIn(['balances', object.asset_type], object.id);

      this.objectsById = this.objectsById.set(object.owner, owner);
    } else if (objectSpace === accountStatsPrefix) {
      // ACCOUNT STATS OBJECT
      // console.log( "HISTORY CHANGED" )
      let prior_most_recent_op = prior ? prior.get('most_recent_op') : '2.9.0';

      if (prior_most_recent_op !== object.most_recent_op) {
        this.fetchRecentHistory(object.owner);
      }
    } else if (objectSpace === witnessPrefix) {
      // WITNESS OBJECT
      if (this._isSubbedTo('witnesses', object.id)) {
        this.witnessByAccountId.set(object.witness_account, object.id);
        this.objectsByVoteId.set(object.vote_id, object.id);
      } else {
        return;
      }
    } else if (objectSpace === committeePrefix) {
      // COMMITTEE MEMBER OBJECT
      if (this._isSubbedTo('committee', object.id)) {
        this.committeeByAccountId.set(object.committee_member_account, object.id);
        this.objectsByVoteId.set(object.vote_id, object.id);
      } else {
        return;
      }
    } else if (objectSpace === accountPrefix) {
      // ACCOUNT OBJECT
      current = current.set('active', Immutable.fromJS(object.active));
      current = current.set('owner', Immutable.fromJS(object.owner));
      current = current.set('options', Immutable.fromJS(object.options));
      current = current.set(
        'pending_dividend_payments',
        Immutable.fromJS(object.pending_dividend_payments)
      );
      current = current.set(
        'whitelisting_accounts',
        Immutable.fromJS(object.whitelisting_accounts)
      );
      current = current.set(
        'blacklisting_accounts',
        Immutable.fromJS(object.blacklisting_accounts)
      );
      current = current.set('whitelisted_accounts', Immutable.fromJS(object.whitelisted_accounts));
      current = current.set('blacklisted_accounts', Immutable.fromJS(object.blacklisted_accounts));
      this.objectsById = this.objectsById.set(object.id, current);
      this.accountsByName = this.accountsByName.set(object.name, object.id);
    } else if (objectSpace === assetPrefix) {
      // ASSET OBJECT
      this.assetsBySymbol = this.assetsBySymbol.set(object.symbol, object.id);
      let dynamic = current.get('dynamic');

      if (!dynamic) {
        let dad = this.getObject(object.dynamic_asset_data_id, true);

        if (!dad) {
          dad = Immutable.Map();
        }

        if (!dad.get('asset_id')) {
          dad = dad.set('asset_id', object.id);
        }

        this.objectsById = this.objectsById.set(object.dynamic_asset_data_id, dad);

        current = current.set('dynamic', dad);
        this.objectsById = this.objectsById.set(object.id, current);
      }

      let bitasset = current.get('bitasset');

      if (!bitasset && object.bitasset_data_id) {
        let bad = this.getObject(object.bitasset_data_id, true);

        if (!bad) {
          bad = Immutable.Map();
        }

        if (!bad.get('asset_id')) {
          bad = bad.set('asset_id', object.id);
        }

        this.objectsById = this.objectsById.set(object.bitasset_data_id, bad);

        current = current.set('bitasset', bad);
        this.objectsById = this.objectsById.set(object.id, current);
      }
    } else if (objectSpace === assetDynamicDataPrefix) {
      // ASSET DYNAMIC DATA OBJECT
      let asset_id = current.get('asset_id');

      if (asset_id) {
        let asset_obj = this.getObject(asset_id);

        if (asset_obj && asset_obj.set) {
          asset_obj = asset_obj.set('dynamic', current);
          this.objectsById = this.objectsById.set(asset_id, asset_obj);
        }
      }
    } else if (objectSpace === workerPrefix) {
      // WORKER OBJECT
      this.objectsByVoteId.set(object.vote_for, object.id);
      this.objectsByVoteId.set(object.vote_against, object.id);
    } else if (objectSpace === bitassetDataPrefix) {
      // BITASSET DATA OBJECT
      let asset_id = current.get('asset_id');

      if (asset_id) {
        let asset = this.getObject(asset_id);

        if (asset) {
          asset = asset.set('bitasset', current);
          emitter.emit('bitasset-update', asset);
          this.objectsById = this.objectsById.set(asset_id, asset);
        }
      }
    } else if (objectSpace === callOrderPrefix) {
      // CALL ORDER OBJECT
      // Update nested call_orders inside account object
      if (emit) {
        emitter.emit('call-order-update', object);
      }

      let account = this.objectsById.get(object.borrower);

      if (account && account.has('call_orders')) {
        let call_orders = account.get('call_orders');

        if (!call_orders.has(object.id)) {
          account = account.set('call_orders', call_orders.add(object.id));
          this.objectsById = this.objectsById.set(account.get('id'), account);
          // Force subscription to the object in the witness node by calling get_objects
          Apis.instance()
            .db_api()
            .exec('get_objects', [[object.id]]);
        }
      }
    } else if (objectSpace === orderPrefix) {
      // LIMIT ORDER OBJECT
      let account = this.objectsById.get(object.seller);

      if (account && account.has('orders')) {
        let limit_orders = account.get('orders');

        if (!limit_orders.has(object.id)) {
          account = account.set('orders', limit_orders.add(object.id));
          this.objectsById = this.objectsById.set(account.get('id'), account);
          // Force subscription to the object in the witness node by calling get_objects
          Apis.instance()
            .db_api()
            .exec('get_objects', [[object.id]]);
        }
      }
    } else if (objectSpace === proposalPrefix) {
      // PROPOSAL OBJECT
      this.addProposalData(object.required_active_approvals, object.id);
      this.addProposalData(object.required_owner_approvals, object.id);
    } else if (objectSpace === tournamentPrefix) {
      // TOURNAMENT OBJECT
      let priorState = prior.get('state');
      let newState = current.get('state');

      if (priorState !== newState) {
        this.tournamentIdsByState = this.tournamentIdsByState
          .map((stateMap, accountId) => stateMap.map((tournamentIdSet, stateString) => {
            if (stateString === priorState) {
              return tournamentIdSet.remove(object.id);
            }

            if (
              stateString === newState
                && (accountId === null
                  || current.getIn(['options', 'whitelist']).isEmpty()
                  || current.getIn(['options', 'whitelist']).includes(accountId))
            ) {
              return tournamentIdSet.add(object.id);
            }

            return tournamentIdSet;
          }));
      }

      if (this.lastTournamentId !== undefined) {
        this.setLastTournamentId(current.get('id'));
      }
    } else if (objectSpace === tournamentDetailsPrefix) {
      let priorRegisteredPlayers = prior.get('registered_players');
      let newRegisteredPlayers = current.get('registered_players');

      if (priorRegisteredPlayers !== newRegisteredPlayers) {
        this.registeredTournamentIdsByPlayer = this.registeredTournamentIdsByPlayer.map(
          (tournamentIdsSet, accountId) => {
            if (newRegisteredPlayers.includes(accountId)) {
              return tournamentIdsSet.add(current.get('tournament_id'));
            }

            return tournamentIdsSet;

            // currently, you can't un-register for a tournament, so we don't have
            // to deal with removing from a list
          }
        );
      }
    }

    if (notify_subscribers) {
      this.notifySubscribers();
    }

    return current;
  }

  setLastTournamentId(current_tournament_id) {
    if (current_tournament_id === null) {
      if (!this.lastTournamentId) {
        this.lastTournamentId = current_tournament_id;
      }
    } else {
      let current_short_string = current_tournament_id.substring(tournamentPrefix.length);
      let current_short = parseFloat(current_short_string);

      let last_short = -1;

      if (this.lastTournamentId) {
        last_short = parseFloat(this.lastTournamentId.substring(tournamentPrefix.length));
      }

      if (current_short > last_short) {
        this.lastTournamentId = current_tournament_id;
      }
    }
  }

  getTournaments(lastTournamentId, limit = 5, start_tournament_id) {
    return Apis.instance()
      .db_api()
      .exec('get_tournaments', [lastTournamentId, limit, start_tournament_id])
      .then((tournaments) => {
        let list = Immutable.List();

        this.setLastTournamentId(null);

        if (tournaments && tournaments.length) {
          list = list.withMutations((l) => {
            tournaments.forEach((tournament) => {
              if (!this.objectsById.has(tournament.id)) {
                this._updateObject(tournament);
              }

              l.unshift(this.objectsById.get(tournament.id));
            });
          });
        }

        return list;
      });
  }

  getLastTournamentId() {
    return new Promise((resolve) => {
      if (this.lastTournamentId === undefined) {
        Apis.instance()
          .db_api()
          .exec('get_tournaments', [`${tournamentPrefix}0`, 1, `${tournamentPrefix}0`])
          .then((tournaments) => {
            this.setLastTournamentId(null);

            if (tournaments && tournaments.length) {
              tournaments.forEach((tournament) => {
                this._updateObject(tournament);
              });
            }

            resolve(this.lastTournamentId);
          });
      } else {
        resolve(this.lastTournamentId);
      }
    });
  }

  getObjectsByVoteIds(vote_ids) {
    let result = [];
    let missing = [];

    for (let i = 0; i < vote_ids.length; ++i) {
      let obj = this.objectsByVoteId.get(vote_ids[i]);

      if (obj) {
        result.push(this.getObject(obj));
      } else {
        missing.push(vote_ids[i]);
      }
    }

    if (missing.length) {
      // we may need to fetch some objects
      Apis.instance()
        .db_api()
        .exec('lookup_vote_ids', [missing])
        .then(
          (vote_obj_array) => {
            for (let i = 0; i < vote_obj_array.length; ++i) {
              if (vote_obj_array[i]) {
                this._updateObject(vote_obj_array[i]);
                let immutableMapConvert = Immutable.fromJS(vote_obj_array[i]);
                result.push(immutableMapConvert);
              }
            }
          },
          (error) => console.log('Error looking up vote ids: ', error)
        );
    }

    return result;
  }

  getObjectByVoteID(vote_id) {
    let obj_id = this.objectsByVoteId.get(vote_id);

    if (obj_id) {
      return this.getObject(obj_id);
    }

    return undefined;
  }

  getHeadBlockDate() {
    return ChainStore.timeStringToDate(this.headBlockTimeString);
  }

  getEstimatedChainTimeOffset() {
    if (this.chainTimeOffset.length === 0) {
      return 0;
    }

    // Immutable is fast, sorts numbers correctly, and leaves the original unmodified
    // This will fix itself if the user changes their clock
    let median_offset = Immutable.List(this.chainTimeOffset)
      .sort()
      .get(Math.floor((this.chainTimeOffset.length - 1) / 2));
    // console.log("median_offset", median_offset)
    return median_offset;
  }

  addProposalData(approvals, objectId) {
    approvals.forEach((id) => {
      let impactedAccount = this.objectsById.get(id);

      if (impactedAccount) {
        let proposals = impactedAccount.get('proposals');

        if (!proposals.includes(objectId)) {
          proposals = proposals.add(objectId);
          impactedAccount = impactedAccount.set('proposals', proposals);
          this._updateObject(impactedAccount.toJS());
        }
      }
    });
  }

  static timeStringToDate(time_string) {
    if (!time_string) {
      return new Date('1970-01-01T00:00:00.000Z');
    }

    // does not end in Z
    if (!/Z$/.test(time_string)) {
      // https://github.com/cryptonomex/graphene/issues/368
      time_string += 'Z';
    }

    return new Date(time_string);
  }

  __getBlocksForScan(lastBlock) {
    let dbApi = Apis.instance().db_api();
    return new Promise((success) => {
      let scanToBlock = this.lastProcessedBlock;

      if (lastBlock) {
        return success({lastBlock, scanToBlock});
      }

      dbApi.exec('get_dynamic_global_properties', []).then((globalProperties) => {
        this.lastProcessedBlock = globalProperties.head_block_number;
        scanToBlock = globalProperties.head_block_number - 2000;
        scanToBlock = scanToBlock < 0 ? 1 : scanToBlock;
        return success({
          lastBlock: this.lastProcessedBlock,
          scanToBlock
        });
      });
    });
  }

  __bindBlock(lastBlock, scanToBlock, isInit) {
    let dbApi = Apis.instance().db_api();
    return new Promise((success) => {
      dbApi.exec('get_block', [lastBlock]).then((block) => {
        block.id = lastBlock;

        if (typeof block.timestamp === 'string') {
          block.timestamp += '+00:00';
        }

        block.timestamp = new Date(block.timestamp);
        this.getWitnessAccount(block.witness).then((witness) => {
          block.witness_account_name = witness.name;

          if (!this.recentBlocksById.get(lastBlock)) {
            this.recentBlocksById = this.recentBlocksById.set(lastBlock, block);

            if (this.lastProcessedBlock < lastBlock) {
              this.lastProcessedBlock = lastBlock;
            }

            if (!isInit) {
              this.recentBlocks = this.recentBlocks.unshift(block);

              if (this.recentBlocks.size > blockStackSize) {
                this.recentBlocks = this.recentBlocks.pop();
              }
            } else if (this.recentBlocks.size < blockStackSize) {
              this.recentBlocks = this.recentBlocks.push(block);
            }

            block.transactions.forEach((tx) => tx.operations.forEach((op) => {
              op[1].block_id = lastBlock;
              op[1].created_at = block.timestamp;

              if (!isInit) {
                this.recentOperations = this.recentOperations.unshift(op);
              } else {
                if (this.recentOperations.size < operationStackSize) {
                  this.recentOperations = this.recentOperations.push(op);
                }

                if (
                  this.recentOperations.size >= operationStackSize
                    && this.recentBlocks.size >= blockStackSize
                ) {
                  scanToBlock = lastBlock;
                }
              }

              if (this.recentOperations.size > operationStackSize) {
                this.recentOperations = this.recentOperations.pop();
              }
            }));
          }

          lastBlock--;

          if (lastBlock <= scanToBlock) {
            return success();
          }

          this.__bindBlock(lastBlock, scanToBlock, isInit).then(() => success());
        });
      });
    });
  }

  fetchRecentOperations(lastBlock = null) {
    if (lastBlock && !this.lastProcessedBlock) {
      return;
    }

    let isInit = !lastBlock;

    this.__getBlocksForScan(lastBlock).then(({lastBlock: last, scanToBlock}) => {
      this.__bindBlock(last, scanToBlock, isInit).then(() => {
        if (isInit) {
          this.storeInitialized = true;
        }
      });
    });
  }

  getRecentBlocks() {
    return this.recentBlocks;
  }

  getRecentOperations() {
    if (!this.storeInitialized) {
      return Immutable.List();
    }

    return this.recentOperations;
  }
}

const chain_store = new ChainStore();

function FetchChainObjects(method, object_ids, timeout) {
  let get_object = method.bind(chain_store);

  return new Promise((resolve, reject) => {
    let timeout_handle = null;

    function onUpdate(not_subscribed_yet = false) {
      let res = object_ids.map((id) => get_object(id));

      if (res.findIndex((o) => o === undefined) === -1) {
        if (timeout_handle) {
          clearTimeout(timeout_handle);
        }

        if (!not_subscribed_yet) {
          chain_store.unsubscribe(onUpdate);
        }

        resolve(res);
        return true;
      }

      return false;
    }

    let resolved = onUpdate(true);

    if (!resolved) {
      chain_store.subscribe(onUpdate);
    }

    if (timeout && !resolved) {
      timeout_handle = setTimeout(() => {
        chain_store.unsubscribe(onUpdate);
        reject(new Error('timeout'));
      }, timeout);
    }
  });
}

chain_store.FetchChainObjects = FetchChainObjects;

function FetchChain(methodName, objectIds, timeout = 1900) {
  let method = chain_store[methodName];

  if (!method) {
    throw new Error(`ChainStore does not have method ${methodName}`);
  }

  let arrayIn = Array.isArray(objectIds);

  if (!arrayIn) {
    objectIds = [objectIds];
  }

  return chain_store
    .FetchChainObjects(method, Immutable.List(objectIds), timeout)
    .then((res) => (arrayIn ? res : res.get(0)));
}

chain_store.FetchChain = FetchChain;

export default chain_store;
