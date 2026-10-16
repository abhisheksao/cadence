package io.github.abhisheksao.cadence.session

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CadenceSessionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CadenceSession")
  }
}
