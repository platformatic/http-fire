'use strict'

const PHASES = {
  STEADY: 'steady',
  SPIKE: 'spike',
  DROP: 'drop'
}

class TrafficGenerator {
  #min
  #max
  #noise
  #steady
  #spike
  #phase
  #phaseProgress
  #phaseDuration
  #currentValue
  #phaseTarget
  #phaseStart

  constructor (config) {
    this.#min = config.min
    this.#max = config.max
    this.#noise = config.noise
    this.#steady = config.steady
    this.#spike = config.spike

    this.#phase = PHASES.STEADY
    this.#phaseProgress = 0
    this.#phaseDuration = this.#steady
    this.#currentValue = this.#min
    this.#phaseTarget = this.#min
    this.#phaseStart = this.#min
  }

  next () {
    this.#phaseProgress++

    if (this.#phase === PHASES.STEADY) {
      if (this.#phaseProgress >= this.#phaseDuration) {
        this.#transitionToNextPhase()
      }
    } else {
      const progress = this.#phaseProgress / this.#phaseDuration
      if (progress >= 1) {
        this.#currentValue = this.#phaseTarget
        this.#transitionToNextPhase()
      } else {
        this.#currentValue = this.#sigmoid(progress)
      }
    }

    return this.#applyNoise(this.#currentValue)
  }

  #sigmoid (progress) {
    const k = Math.max(1, 20 - this.#spike / 6)
    const x = (progress - 0.5) * k
    const sigmoidValue = 1 / (1 + Math.exp(-x))
    return this.#phaseStart + (this.#phaseTarget - this.#phaseStart) * sigmoidValue
  }

  #applyNoise (value) {
    const gaussianNoise = this.#gaussianRandom() * this.#noise * value
    const noisy = value + gaussianNoise
    return Math.round(Math.max(this.#min, Math.min(this.#max, noisy)))
  }

  #gaussianRandom () {
    const u1 = Math.random()
    const u2 = Math.random()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }

  #transitionToNextPhase () {
    this.#phaseProgress = 0
    this.#phaseStart = this.#currentValue

    if (this.#phase === PHASES.STEADY) {
      this.#phaseDuration = this.#spike
      if (this.#currentValue < (this.#min + this.#max) / 2) {
        this.#phase = PHASES.SPIKE
        this.#phaseTarget = this.#min + (this.#max - this.#min) * (0.6 + Math.random() * 0.4)
      } else {
        this.#phase = PHASES.DROP
        this.#phaseTarget = this.#min + (this.#max - this.#min) * (Math.random() * 0.4)
      }
    } else {
      this.#phase = PHASES.STEADY
      this.#phaseDuration = this.#steady
      this.#phaseTarget = this.#currentValue
    }
  }
}

module.exports = { TrafficGenerator }
