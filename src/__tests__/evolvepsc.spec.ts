import ArLocal from '@textury/arlocal';
import Arweave from 'arweave';

import { createContract } from '../contract-create';
import { interactWrite } from '../contract-interact';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { readContract } from '../contract-read';

const contractSrc = `export function handle(state, action) {
  const settings = new Map(state.settings);
  const balances = state.balances;
  const vault = state.vault;
  const votes = state.votes;
  const input = action.input;
  const caller = action.caller;
  if (input.function === "transfer") {
    const target = isArweaveAddress(input.target);
    const qty = input.qty;
    if (!Number.isInteger(qty)) {
      throw new ContractError('Invalid value for "qty". Must be an integer.');
    }
    if (!target) {
      throw new ContractError("No target specified.");
    }
    if (qty <= 0 || caller === target) {
      throw new ContractError("Invalid token transfer.");
    }
    if (!(caller in balances)) {
      throw new ContractError("Caller doesn't own any DAO balance.");
    }
    if (balances[caller] < qty) {
      throw new ContractError(\`Caller balance not high enough to send \${qty} token(s)!\`);
    }
    balances[caller] -= qty;
    if (target in balances) {
      balances[target] += qty;
    } else {
      balances[target] = qty;
    }
    return {state};
  }
  if (input.function === "balance") {
    const target = isArweaveAddress(input.target || caller);
    if (typeof target !== "string") {
      throw new ContractError("Must specificy target to get balance for.");
    }
    let balance = 0;
    if (target in balances) {
      balance = balances[target];
    }
    if (target in vault && vault[target].length) {
      try {
        balance += vault[target].map((a) => a.balance).reduce((a, b) => a + b, 0);
      } catch (e) {
      }
    }
    return {result: {target, balance}};
  }
  if (input.function === "unlockedBalance") {
    const target = isArweaveAddress(input.target || caller);
    if (typeof target !== "string") {
      throw new ContractError("Must specificy target to get balance for.");
    }
    if (!(target in balances)) {
      throw new ContractError("Cannnot get balance, target does not exist.");
    }
    let balance = balances[target];
    return {result: {target, balance}};
  }
  if (input.function === "lock") {
    const qty = input.qty;
    const lockLength = input.lockLength;
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ContractError("Quantity must be a positive integer.");
    }
    if (!Number.isInteger(lockLength) || lockLength < settings.get("lockMinLength") || lockLength > settings.get("lockMaxLength")) {
      throw new ContractError(\`lockLength is out of range. lockLength must be between \${settings.get("lockMinLength")} - \${settings.get("lockMaxLength")}.\`);
    }
    const balance = balances[caller];
    if (isNaN(balance) || balance < qty) {
      throw new ContractError("Not enough balance.");
    }
    balances[caller] -= qty;
    const start = +SmartWeave.block.height;
    const end = start + lockLength;
    if (caller in vault) {
      vault[caller].push({
        balance: qty,
        end,
        start
      });
    } else {
      vault[caller] = [{
        balance: qty,
        end,
        start
      }];
    }
    return {state};
  }
  if (input.function === "increaseVault") {
    const lockLength = input.lockLength;
    const id = input.id;
    if (!Number.isInteger(lockLength) || lockLength < settings.get("lockMinLength") || lockLength > settings.get("lockMaxLength")) {
      throw new ContractError(\`lockLength is out of range. lockLength must be between \${settings.get("lockMinLength")} - \${settings.get("lockMaxLength")}.\`);
    }
    if (caller in vault) {
      if (!vault[caller][id]) {
        throw new ContractError("Invalid vault ID.");
      }
    } else {
      throw new ContractError("Caller does not have a vault.");
    }
    if (+SmartWeave.block.height >= vault[caller][id].end) {
      throw new ContractError("This vault has ended.");
    }
    vault[caller][id].end = +SmartWeave.block.height + lockLength;
    return {state};
  }
  if (input.function === "unlock") {
    if (caller in vault && vault[caller].length) {
      let i = vault[caller].length;
      while (i--) {
        const locked = vault[caller][i];
        if (+SmartWeave.block.height >= locked.end) {
          if (caller in balances && typeof balances[caller] === "number") {
            balances[caller] += locked.balance;
          } else {
            balances[caller] = locked.balance;
          }
          vault[caller].splice(i, 1);
        }
      }
    }
    return {state};
  }
  if (input.function === "vaultBalance") {
    const target = isArweaveAddress(input.target || caller);
    let balance = 0;
    if (target in vault) {
      const blockHeight = +SmartWeave.block.height;
      const filtered = vault[target].filter((a) => blockHeight < a.end);
      for (let i = 0, j = filtered.length; i < j; i++) {
        balance += filtered[i].balance;
      }
    }
    return {result: {target, balance}};
  }
  if (input.function === "propose") {
    const voteType = input.type;
    const note = input.note;
    if (typeof note !== "string") {
      throw new ContractError("Note format not recognized.");
    }
    if (!(caller in vault)) {
      throw new ContractError("Caller needs to have locked balances.");
    }
    const hasBalance = vault[caller] && !!vault[caller].filter((a) => a.balance > 0).length;
    if (!hasBalance) {
      throw new ContractError("Caller doesn't have any locked balance.");
    }
    let totalWeight = 0;
    const vaultValues = Object.values(vault);
    for (let i = 0, j = vaultValues.length; i < j; i++) {
      const locked = vaultValues[i];
      for (let j2 = 0, k = locked.length; j2 < k; j2++) {
        totalWeight += locked[j2].balance * (locked[j2].end - locked[j2].start);
      }
    }
    let vote = {
      status: "active",
      type: voteType,
      note,
      yays: 0,
      nays: 0,
      voted: [],
      start: +SmartWeave.block.height,
      totalWeight
    };
    if (voteType === "mint" || voteType === "mintLocked") {
      const recipient = isArweaveAddress(input.recipient);
      const qty = +input.qty;
      if (!recipient) {
        throw new ContractError("No recipient specified");
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new ContractError('Invalid value for "qty". Must be a positive integer.');
      }
      let totalSupply = 0;
      const vaultValues2 = Object.values(vault);
      for (let i = 0, j = vaultValues2.length; i < j; i++) {
        const locked = vaultValues2[i];
        for (let j2 = 0, k = locked.length; j2 < k; j2++) {
          totalSupply += locked[j2].balance;
        }
      }
      const balancesValues = Object.values(balances);
      for (let i = 0, j = balancesValues.length; i < j; i++) {
        totalSupply += balancesValues[i];
      }
      if (totalSupply + qty > Number.MAX_SAFE_INTEGER) {
        throw new ContractError("Quantity too large.");
      }
      let lockLength = {};
      if (input.lockLength) {
        if (!Number.isInteger(input.lockLength) || input.lockLength < settings.get("lockMinLength") || input.lockLength > settings.get("lockMaxLength")) {
          throw new ContractError(\`lockLength is out of range. lockLength must be between \${settings.get("lockMinLength")} - \${settings.get("lockMaxLength")}.\`);
        }
        lockLength = {lockLength: input.lockLength};
      }
      Object.assign(vote, {
        recipient,
        qty
      }, lockLength);
      votes.push(vote);
    } else if (voteType === "burnVault") {
      const target = isArweaveAddress(input.target);
      if (!target || typeof target !== "string") {
        throw new ContractError("Target is required.");
      }
      Object.assign(vote, {
        target
      });
      votes.push(vote);
    } else if (voteType === "set") {
      if (typeof input.key !== "string") {
        throw new ContractError("Data type of key not supported.");
      }
      if (input.key === "quorum" || input.key === "support" || input.key === "lockMinLength" || input.key === "lockMaxLength") {
        input.value = +input.value;
      }
      if (input.key === "quorum") {
        if (isNaN(input.value) || input.value < 0.01 || input.value > 0.99) {
          throw new ContractError("Quorum must be between 0.01 and 0.99.");
        }
      } else if (input.key === "support") {
        if (isNaN(input.value) || input.value < 0.01 || input.value > 0.99) {
          throw new ContractError("Support must be between 0.01 and 0.99.");
        }
      } else if (input.key === "lockMinLength") {
        if (!Number.isInteger(input.value) || input.value < 1 || input.value >= settings.get("lockMaxLength")) {
          throw new ContractError("lockMinLength cannot be less than 1 and cannot be equal or greater than lockMaxLength.");
        }
      } else if (input.key === "lockMaxLength") {
        if (!Number.isInteger(input.value) || input.value <= settings.get("lockMinLength")) {
          throw new ContractError("lockMaxLength cannot be less than or equal to lockMinLength.");
        }
      }
      if (input.key === "role") {
        const recipient = isArweaveAddress(input.recipient);
        if (!recipient) {
          throw new ContractError("No recipient specified");
        }
        Object.assign(vote, {
          key: input.key,
          value: input.value,
          recipient
        });
      } else {
        Object.assign(vote, {
          key: input.key,
          value: input.value
        });
      }
      votes.push(vote);
    } else if (voteType === "indicative") {
      votes.push(vote);
    } else {
      throw new ContractError("Invalid vote type.");
    }
    return {state};
  }
  if (input.function === "vote") {
    const id = input.id;
    const cast = input.cast;
    if (!Number.isInteger(id)) {
      throw new ContractError('Invalid value for "id". Must be an integer.');
    }
    const vote = votes[id];
    let voterBalance = 0;
    if (caller in vault) {
      for (let i = 0, j = vault[caller].length; i < j; i++) {
        const locked = vault[caller][i];
        if (locked.start < vote.start && locked.end >= vote.start) {
          voterBalance += locked.balance * (locked.end - locked.start);
        }
      }
    }
    if (voterBalance <= 0) {
      throw new ContractError("Caller does not have locked balances for this vote.");
    }
    if (vote.voted.includes(caller)) {
      throw new ContractError("Caller has already voted.");
    }
    if (+SmartWeave.block.height >= vote.start + settings.get("voteLength")) {
      throw new ContractError("Vote has already concluded.");
    }
    if (cast === "yay") {
      vote.yays += voterBalance;
    } else if (cast === "nay") {
      vote.nays += voterBalance;
    } else {
      throw new ContractError("Vote cast type unrecognised.");
    }
    vote.voted.push(caller);
    return {state};
  }
  if (input.function === "finalize") {
    const id = input.id;
    const vote = votes[id];
    const qty = vote.qty;
    if (!vote) {
      throw new ContractError("This vote doesn't exists.");
    }
    if (+SmartWeave.block.height < vote.start + settings.get("voteLength")) {
      throw new ContractError("Vote has not yet concluded.");
    }
    if (vote.status !== "active") {
      throw new ContractError("Vote is not active.");
    }
    if (vote.totalWeight * settings.get("quorum") > vote.yays + vote.nays) {
      vote.status = "quorumFailed";
      return {state};
    }
    if (vote.yays !== 0 && (vote.nays === 0 || vote.yays / vote.nays > settings.get("support"))) {
      vote.status = "passed";
      if (vote.type === "mint" || vote.type === "mintLocked") {
        let totalSupply = 0;
        const vaultValues = Object.values(vault);
        for (let i = 0, j = vaultValues.length; i < j; i++) {
          const locked = vaultValues[i];
          for (let j2 = 0, k = locked.length; j2 < k; j2++) {
            totalSupply += locked[j2].balance;
          }
        }
        const balancesValues = Object.values(balances);
        for (let i = 0, j = balancesValues.length; i < j; i++) {
          totalSupply += balancesValues[i];
        }
        if (totalSupply + qty > Number.MAX_SAFE_INTEGER) {
          throw new ContractError("Quantity too large.");
        }
      }
      if (vote.type === "mint") {
        if (vote.recipient in balances) {
          balances[vote.recipient] += qty;
        } else {
          balances[vote.recipient] = qty;
        }
      } else if (vote.type === "mintLocked") {
        const start = +SmartWeave.block.height;
        const end = start + vote.lockLength;
        const locked = {
          balance: qty,
          start,
          end
        };
        if (vote.recipient in vault) {
          vault[vote.recipient].push(locked);
        } else {
          vault[vote.recipient] = [locked];
        }
      } else if (vote.type === "burnVault") {
        if (vote.target in vault) {
          delete vault[vote.target];
        } else {
          vote.status = "failed";
        }
      } else if (vote.type === "set") {
        if (vote.key === "role") {
          state.roles[vote.recipient] = vote.value;
        } else {
          settings.set(vote.key, vote.value);
          state.settings = Array.from(settings);
        }
      }
    } else {
      vote.status = "failed";
    }
    return {state};
  }
  if (input.function === "role") {
    const target = isArweaveAddress(input.target || caller);
    const role = target in state.roles ? state.roles[target] : "";
    if (!role.trim().length) {
      throw new ContractError("Target doesn't have a role specified.");
    }
    return {result: {target, role}};
  }
  function isArweaveAddress(addy) {
    const address = addy.toString().trim();
    if (!/[a-z0-9_-]{43}/i.test(address)) {
      throw new ContractError("Invalid Arweave address.");
    }
    return address;
  }
  throw new ContractError(\`No function supplied or function not recognised: "\${input.function}"\`);
}
`;

const contractSrcEvolved = `export function handle(state, action) {
  const settings = new Map(state.settings);
  const balances = state.balances;
  const vault = state.vault;
  const votes = state.votes;
  const input = action.input;
  const caller = action.caller;
  if (input.function === "transfer") {
    const target = isArweaveAddress(input.target);
    const qty = input.qty;
    if (!Number.isInteger(qty)) {
      throw new ContractError('Invalid value for "qty". Must be an integer.');
    }
    if (!target) {
      throw new ContractError("No target specified.");
    }
    if (qty <= 0 || caller === target) {
      throw new ContractError("Invalid token transfer.");
    }
    if (!(caller in balances)) {
      throw new ContractError("Caller doesn't own any DAO balance.");
    }
    if (balances[caller] < qty) {
      throw new ContractError(\`Caller balance not high enough to send \${qty} token(s)!\`);
    }
    balances[caller] -= qty;
    balances[caller] += 10;
    if (target in balances) {
      balances[target] += qty;
    } else {
      balances[target] = qty;
    }
    return {state};
  }
  if (input.function === "transferLocked") {
    const target = isArweaveAddress(input.target);
    const qty = +input.qty;
    const lockLength = +input.lockLength;
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ContractError("Quantity must be a positive integer.");
    }
    if (!Number.isInteger(lockLength) || lockLength < settings.get("lockMinLength") || lockLength > settings.get("lockMaxLength")) {
      throw new ContractError(\`lockLength is out of range. lockLength must be between \${settings.get("lockMinLength")} - \${settings.get("lockMaxLength")}.\`);
    }
    const balance = balances[caller];
    if (isNaN(balance) || balance < qty) {
      throw new ContractError("Not enough balance.");
    }
    balances[caller] -= qty;
    const start = +SmartWeave.block.height;
    const end = start + lockLength;
    if (target in vault) {
      vault[target].push({
        balance: qty,
        end,
        start
      });
    } else {
      vault[target] = [{
        balance: qty,
        end,
        start
      }];
    }
    return {state};
  }
  if (input.function === "balance") {
    const target = isArweaveAddress(input.target || caller);
    if (typeof target !== "string") {
      throw new ContractError("Must specificy target to get balance for.");
    }
    let balance = 0;
    if (target in balances) {
      balance = balances[target];
    }
    if (target in vault && vault[target].length) {
      try {
        balance += vault[target].map((a) => a.balance).reduce((a, b) => a + b, 0);
      } catch (e) {
      }
    }
    return {result: {target, balance}};
  }
  if (input.function === "unlockedBalance") {
    const target = isArweaveAddress(input.target || caller);
    if (typeof target !== "string") {
      throw new ContractError("Must specificy target to get balance for.");
    }
    if (!(target in balances)) {
      throw new ContractError("Cannnot get balance, target does not exist.");
    }
    let balance = balances[target];
    return {result: {target, balance}};
  }
  if (input.function === "lock") {
    const qty = input.qty;
    const lockLength = input.lockLength;
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ContractError("Quantity must be a positive integer.");
    }
    if (!Number.isInteger(lockLength) || lockLength < settings.get("lockMinLength") || lockLength > settings.get("lockMaxLength")) {
      throw new ContractError(\`lockLength is out of range. lockLength must be between \${settings.get("lockMinLength")} - \${settings.get("lockMaxLength")}.\`);
    }
    const balance = balances[caller];
    if (isNaN(balance) || balance < qty) {
      throw new ContractError("Not enough balance.");
    }
    balances[caller] -= qty;
    const start = +SmartWeave.block.height;
    const end = start + lockLength;
    if (caller in vault) {
      vault[caller].push({
        balance: qty,
        end,
        start
      });
    } else {
      vault[caller] = [{
        balance: qty,
        end,
        start
      }];
    }
    return {state};
  }
  if (input.function === "increaseVault") {
    const lockLength = input.lockLength;
    const id = input.id;
    if (!Number.isInteger(lockLength) || lockLength < settings.get("lockMinLength") || lockLength > settings.get("lockMaxLength")) {
      throw new ContractError(\`lockLength is out of range. lockLength must be between \${settings.get("lockMinLength")} - \${settings.get("lockMaxLength")}.\`);
    }
    if (caller in vault) {
      if (!vault[caller][id]) {
        throw new ContractError("Invalid vault ID.");
      }
    } else {
      throw new ContractError("Caller does not have a vault.");
    }
    if (+SmartWeave.block.height >= vault[caller][id].end) {
      throw new ContractError("This vault has ended.");
    }
    vault[caller][id].end = +SmartWeave.block.height + lockLength;
    return {state};
  }
  if (input.function === "unlock") {
    if (caller in vault && vault[caller].length) {
      let i = vault[caller].length;
      while (i--) {
        const locked = vault[caller][i];
        if (+SmartWeave.block.height >= locked.end) {
          if (caller in balances && typeof balances[caller] === "number") {
            balances[caller] += locked.balance;
          } else {
            balances[caller] = locked.balance;
          }
          vault[caller].splice(i, 1);
        }
      }
    }
    return {state};
  }
  if (input.function === "vaultBalance") {
    const target = isArweaveAddress(input.target || caller);
    let balance = 0;
    if (target in vault) {
      const blockHeight = +SmartWeave.block.height;
      const filtered = vault[target].filter((a) => blockHeight < a.end);
      for (let i = 0, j = filtered.length; i < j; i++) {
        balance += filtered[i].balance;
      }
    }
    return {result: {target, balance}};
  }
  if (input.function === "propose") {
    const voteType = input.type;
    const note = input.note;
    if (typeof note !== "string") {
      throw new ContractError("Note format not recognized.");
    }
    if (!(caller in vault)) {
      throw new ContractError("Caller needs to have locked balances.");
    }
    const hasBalance = vault[caller] && !!vault[caller].filter((a) => a.balance > 0).length;
    if (!hasBalance) {
      throw new ContractError("Caller doesn't have any locked balance.");
    }
    let totalWeight = 0;
    const vaultValues = Object.values(vault);
    for (let i = 0, j = vaultValues.length; i < j; i++) {
      const locked = vaultValues[i];
      for (let j2 = 0, k = locked.length; j2 < k; j2++) {
        totalWeight += locked[j2].balance * (locked[j2].end - locked[j2].start);
      }
    }
    let vote = {
      status: "active",
      type: voteType,
      note,
      yays: 0,
      nays: 0,
      voted: [],
      start: +SmartWeave.block.height,
      totalWeight
    };
    if (voteType === "mint" || voteType === "mintLocked") {
      const recipient = isArweaveAddress(input.recipient);
      const qty = +input.qty;
      if (!recipient) {
        throw new ContractError("No recipient specified");
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new ContractError('Invalid value for "qty". Must be a positive integer.');
      }
      let totalSupply = 0;
      const vaultValues2 = Object.values(vault);
      for (let i = 0, j = vaultValues2.length; i < j; i++) {
        const locked = vaultValues2[i];
        for (let j2 = 0, k = locked.length; j2 < k; j2++) {
          totalSupply += locked[j2].balance;
        }
      }
      const balancesValues = Object.values(balances);
      for (let i = 0, j = balancesValues.length; i < j; i++) {
        totalSupply += balancesValues[i];
      }
      if (totalSupply + qty > Number.MAX_SAFE_INTEGER) {
        throw new ContractError("Quantity too large.");
      }
      let lockLength = {};
      if (input.lockLength) {
        if (!Number.isInteger(input.lockLength) || input.lockLength < settings.get("lockMinLength") || input.lockLength > settings.get("lockMaxLength")) {
          throw new ContractError(\`lockLength is out of range. lockLength must be between \${settings.get("lockMinLength")} - \${settings.get("lockMaxLength")}.\`);
        }
        lockLength = {lockLength: input.lockLength};
      }
      Object.assign(vote, {
        recipient,
        qty
      }, lockLength);
      votes.push(vote);
    } else if (voteType === "burnVault") {
      const target = isArweaveAddress(input.target);
      if (!target || typeof target !== "string") {
        throw new ContractError("Target is required.");
      }
      Object.assign(vote, {
        target
      });
      votes.push(vote);
    } else if (voteType === "set") {
      if (typeof input.key !== "string") {
        throw new ContractError("Data type of key not supported.");
      }
      if (input.key === "quorum" || input.key === "support" || input.key === "lockMinLength" || input.key === "lockMaxLength") {
        input.value = +input.value;
      }
      if (input.key === "quorum") {
        if (isNaN(input.value) || input.value < 0.01 || input.value > 0.99) {
          throw new ContractError("Quorum must be between 0.01 and 0.99.");
        }
      } else if (input.key === "support") {
        if (isNaN(input.value) || input.value < 0.01 || input.value > 0.99) {
          throw new ContractError("Support must be between 0.01 and 0.99.");
        }
      } else if (input.key === "lockMinLength") {
        if (!Number.isInteger(input.value) || input.value < 1 || input.value >= settings.get("lockMaxLength")) {
          throw new ContractError("lockMinLength cannot be less than 1 and cannot be equal or greater than lockMaxLength.");
        }
      } else if (input.key === "lockMaxLength") {
        if (!Number.isInteger(input.value) || input.value <= settings.get("lockMinLength")) {
          throw new ContractError("lockMaxLength cannot be less than or equal to lockMinLength.");
        }
      }
      if (input.key === "role") {
        const recipient = isArweaveAddress(input.recipient);
        if (!recipient) {
          throw new ContractError("No recipient specified");
        }
        Object.assign(vote, {
          key: input.key,
          value: input.value,
          recipient
        });
      } else {
        Object.assign(vote, {
          key: input.key,
          value: input.value
        });
      }
      votes.push(vote);
    } else if (voteType === "indicative") {
      votes.push(vote);
    } else {
      throw new ContractError("Invalid vote type.");
    }
    return {state};
  }
  if (input.function === "vote") {
    const id = input.id;
    const cast = input.cast;
    if (!Number.isInteger(id)) {
      throw new ContractError('Invalid value for "id". Must be an integer.');
    }
    const vote = votes[id];
    let voterBalance = 0;
    if (caller in vault) {
      for (let i = 0, j = vault[caller].length; i < j; i++) {
        const locked = vault[caller][i];
        if (locked.start < vote.start && locked.end >= vote.start) {
          voterBalance += locked.balance * (locked.end - locked.start);
        }
      }
    }
    if (voterBalance <= 0) {
      throw new ContractError("Caller does not have locked balances for this vote.");
    }
    if (vote.voted.includes(caller)) {
      throw new ContractError("Caller has already voted.");
    }
    if (+SmartWeave.block.height >= vote.start + settings.get("voteLength")) {
      throw new ContractError("Vote has already concluded.");
    }
    if (cast === "yay") {
      vote.yays += voterBalance;
    } else if (cast === "nay") {
      vote.nays += voterBalance;
    } else {
      throw new ContractError("Vote cast type unrecognised.");
    }
    vote.voted.push(caller);
    return {state};
  }
  if (input.function === "finalize") {
    const id = input.id;
    const vote = votes[id];
    const qty = vote.qty;
    if (!vote) {
      throw new ContractError("This vote doesn't exists.");
    }
    if (+SmartWeave.block.height < vote.start + settings.get("voteLength")) {
      throw new ContractError("Vote has not yet concluded.");
    }
    if (vote.status !== "active") {
      throw new ContractError("Vote is not active.");
    }
    if (vote.totalWeight * settings.get("quorum") > vote.yays + vote.nays) {
      vote.status = "quorumFailed";
      return {state};
    }
    if (vote.yays !== 0 && (vote.nays === 0 || vote.yays / vote.nays > settings.get("support"))) {
      vote.status = "passed";
      if (vote.type === "mint" || vote.type === "mintLocked") {
        let totalSupply = 0;
        const vaultValues = Object.values(vault);
        for (let i = 0, j = vaultValues.length; i < j; i++) {
          const locked = vaultValues[i];
          for (let j2 = 0, k = locked.length; j2 < k; j2++) {
            totalSupply += locked[j2].balance;
          }
        }
        const balancesValues = Object.values(balances);
        for (let i = 0, j = balancesValues.length; i < j; i++) {
          totalSupply += balancesValues[i];
        }
        if (totalSupply + qty > Number.MAX_SAFE_INTEGER) {
          throw new ContractError("Quantity too large.");
        }
      }
      if (vote.type === "mint") {
        if (vote.recipient in balances) {
          balances[vote.recipient] += qty;
        } else {
          balances[vote.recipient] = qty;
        }
      } else if (vote.type === "mintLocked") {
        const start = +SmartWeave.block.height;
        const end = start + vote.lockLength;
        const locked = {
          balance: qty,
          start,
          end
        };
        if (vote.recipient in vault) {
          vault[vote.recipient].push(locked);
        } else {
          vault[vote.recipient] = [locked];
        }
      } else if (vote.type === "burnVault") {
        if (vote.target in vault) {
          delete vault[vote.target];
        } else {
          vote.status = "failed";
        }
      } else if (vote.type === "set") {
        if (vote.key === "role") {
          state.roles[vote.recipient] = vote.value;
        } else {
          settings.set(vote.key, vote.value);
          state.settings = Array.from(settings);
        }
      }
    } else {
      vote.status = "failed";
    }
    return {state};
  }
  if (input.function === "role") {
    const target = isArweaveAddress(input.target || caller);
    const role = target in state.roles ? state.roles[target] : "";
    if (!role.trim().length) {
      throw new ContractError("Target doesn't have a role specified.");
    }
    return {result: {target, role}};
  }
  function isArweaveAddress(addy) {
    const address = addy.toString().trim();
    if (!/[a-z0-9_-]{43}/i.test(address)) {
      throw new ContractError("Invalid Arweave address.");
    }
    return address;
  }
  throw new ContractError(\`No function supplied or function not recognised: "\${input.function}"\`);
}

`;

const contractState = {
  name: 'My DAO Name',
  ticker: 'TOK',
  balances: {},
  vault: {},
  votes: [],
  roles: {},
  settings: [
    ['quorum', 0.5],
    ['support', 0.5],
    ['voteLength', 10],
    ['lockMinLength', 5],
    ['lockMaxLength', 720],
  ],
};

let arlocal: ArLocal;
let inst: Arweave;

describe('contract source evolve', () => {
  let evolvedContractTxId = '';
  let contract = '';

  let wallet: JWKInterface;
  let addy = '';

  beforeAll(async () => {
    arlocal = new ArLocal(1986, false);
    await arlocal.start();

    inst = Arweave.init({
      host: 'localhost',
      port: 1986,
      protocol: 'http',
    });

    wallet = await inst.wallets.generate();
    addy = await inst.wallets.jwkToAddress(wallet);

    contractState.balances[addy] = 100;
    contractState.vault[addy] = [
      {
        balance: 100,
        end: 10000000000,
        start: 0,
      },
    ];

    contract = await createContract(inst, wallet, contractSrc, JSON.stringify(contractState));

    const tx = await inst.createTransaction({ data: contractSrcEvolved }, wallet);
    tx.addTag('App-Name', 'SmartWeaveContractSource');
    tx.addTag('App-Version', '0.3.0');
    tx.addTag('Content-Type', 'application/javascript');

    await inst.transactions.sign(tx, wallet);
    evolvedContractTxId = tx.id;
    await inst.transactions.post(tx);

    await mine();
  });

  afterAll(async () => {
    await arlocal.stop();
  });

  test('evolve PSC contract', async () => {
    // Reduce balance, should be at 50
    await interactWrite(inst, wallet, contract, {
      function: 'transfer',
      target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
      qty: 50,
    });
    await mine();

    let state = await readContract(inst, contract);
    console.log(state);
    expect(state.balances[addy]).toBe(50);

    await mine();

    // Let's propose the evolve vote
    await interactWrite(inst, wallet, contract, {
      function: 'propose',
      key: 'evolve',
      value: evolvedContractTxId,
      note: 'Test vote evolve',
      type: 'set',
    });
    await mine();

    // Let's vote on the proposal
    state = await readContract(inst, contract);
    await interactWrite(inst, wallet, contract, { function: 'vote', id: state.votes.length - 1, cast: 'yay' });
    await mine(50);

    // Finalize the proposal
    await interactWrite(inst, wallet, contract, { function: 'finalize', id: state.votes.length - 1 });
    await mine();

    // Reduce balance, should be 10
    await interactWrite(inst, wallet, contract, {
      function: 'transfer',
      target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
      qty: 50,
    });
    await mine();

    const stateEvolved = await readContract(inst, contract);
    console.log(stateEvolved);
    expect(stateEvolved.balances[addy]).toBe(10);
  });
});

async function mine(len: number = 1) {
  await inst.api.get(`mine/${len}`);
}
