'use strict';

class Heap {
  constructor(comparator = (a, b) => a - b) {
    this.data = [];
    this.compare = comparator;
  }

  size() {
    return this.data.length;
  }

  isEmpty() {
    return this.data.length === 0;
  }

  peek() {
    return this.data.length > 0 ? this.data[0] : null;
  }

  push(value) {
    this.data.push(value);
    this._siftUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return null;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  _siftUp(index) {
    let idx = index;
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.compare(this.data[idx], this.data[parentIdx]) < 0) {
        [this.data[idx], this.data[parentIdx]] = [this.data[parentIdx], this.data[idx]];
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  _siftDown(index) {
    let idx = index;
    const len = this.data.length;
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;

      if (left < len && this.compare(this.data[left], this.data[smallest]) < 0) {
        smallest = left;
      }
      if (right < len && this.compare(this.data[right], this.data[smallest]) < 0) {
        smallest = right;
      }
      if (smallest !== idx) {
        [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

module.exports = Heap;