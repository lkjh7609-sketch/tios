#!/usr/bin/env ruby
# frozen_string_literal: true
#
# iOS 프로젝트(ios/App/App.xcodeproj)에 위젯(TripticWidget)·애플워치(TripticWatch) 대상과 Shared 코드를 넣는다.
# Xcode가 없는 환경에서 project.pbxproj를 손으로 고치는 대신 xcodeproj 젬으로 하려고 만든 스크립트 — 여러 번 돌려도 같은 결과(이미 있으면 건너뜀).
#   gem install xcodeproj --user-install   (루비 2.6이면 이걸로 됨)
#   ruby scripts/ios-add-widget-watch.rb
# 결과(project.pbxproj)는 저장소에 커밋한다. 다시 돌릴 일은 대상 설정을 바꿀 때뿐.
require 'xcodeproj'
require 'fileutils'

ROOT = File.expand_path('../ios/App', __dir__)
PROJECT_PATH = File.join(ROOT, 'App.xcodeproj')
APP_BUNDLE = 'com.triptic.travel'
WIDGET_BUNDLE = "#{APP_BUNDLE}.widget"
WATCH_BUNDLE = "#{APP_BUNDLE}.watchkitapp"
APP_GROUP = 'group.com.triptic.travel'
VERSION = '1.0.1'

project = Xcodeproj::Project.open(PROJECT_PATH)
app = project.targets.find { |t| t.name == 'App' } or abort('App 대상이 없다')

def group_for(project, name)
  project.main_group.children.find { |c| c.display_name == name } || project.main_group.new_group(name, name)
end

def add_files(group, target, names)
  names.each do |n|
    ref = group.files.find { |f| f.path == n } || group.new_file(n)
    target.add_file_references([ref]) unless target.source_build_phase.files_references.include?(ref)
    ref
  end
end

shared_names = %w[TripModels.swift TripLogic.swift TripStrings.swift]
shared_group = group_for(project, 'Shared')
shared_refs = shared_names.map { |n| shared_group.files.find { |f| f.path == n } || shared_group.new_file(n) }
def attach(target, refs)
  refs.each { |ref| target.add_file_references([ref]) unless target.source_build_phase.files_references.include?(ref) }
end

# ── App: 폰 쪽 코드(앱 그룹 저장·워치 전송·플러그인)와 Shared ──
app_group = project.main_group.children.find { |c| c.display_name == 'App' }
%w[TripSync.swift TripSharePlugin.swift MainViewController.swift].each do |n|
  ref = app_group.files.find { |f| f.path == n } || app_group.new_file(n)
  attach(app, [ref])
end
attach(app, shared_refs)

def base_settings(config, bundle_id, plist, entitlements: nil)
  s = config.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = plist
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['CODE_SIGN_ENTITLEMENTS'] = entitlements if entitlements
  s['MARKETING_VERSION'] = VERSION
  s['CURRENT_PROJECT_VERSION'] = '1'
  s['SWIFT_VERSION'] = '5.0'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SKIP_INSTALL'] = 'YES'
  s['CLANG_ENABLE_MODULES'] = 'YES'
  s['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
  s['DEBUG_INFORMATION_FORMAT'] = config.name == 'Debug' ? 'dwarf' : 'dwarf-with-dsym'
  s['SWIFT_OPTIMIZATION_LEVEL'] = config.name == 'Debug' ? '-Onone' : '-O'
end

# ── 위젯 확장 ──
widget = project.targets.find { |t| t.name == 'TripticWidget' }
unless widget
  widget = project.new_target(:app_extension, 'TripticWidget', :ios, '16.0')
  widget.build_configurations.each do |c|
    base_settings(c, WIDGET_BUNDLE, 'TripticWidget/Info.plist', entitlements: 'TripticWidget/TripticWidget.entitlements')
    c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
    c.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
    c.build_settings['SDKROOT'] = 'iphoneos'
    c.build_settings['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  end
end
widget_group = group_for(project, 'TripticWidget')
add_files(widget_group, widget, %w[TripticWidget.swift])
%w[Info.plist TripticWidget.entitlements].each { |n| widget_group.files.find { |f| f.path == n } || widget_group.new_file(n) }
privacy = widget_group.files.find { |f| f.path == 'PrivacyInfo.xcprivacy' } || widget_group.new_file('PrivacyInfo.xcprivacy')
widget.resources_build_phase.add_file_reference(privacy) unless widget.resources_build_phase.files_references.include?(privacy)
attach(widget, shared_refs)

# ── 애플워치 앱(워치 전용 단일 대상, watchOS 9+) ──
watch = project.targets.find { |t| t.name == 'TripticWatch' }
unless watch
  watch = project.new_target(:application, 'TripticWatch', :watchos, '9.0')
  watch.build_configurations.each do |c|
    base_settings(c, WATCH_BUNDLE, 'TripticWatch/Info.plist')
    c.build_settings['SDKROOT'] = 'watchos'
    c.build_settings['SUPPORTED_PLATFORMS'] = 'watchos watchsimulator'
    c.build_settings['WATCHOS_DEPLOYMENT_TARGET'] = '9.0'
    c.build_settings['TARGETED_DEVICE_FAMILY'] = '4'
    c.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
    c.build_settings['SKIP_INSTALL'] = 'NO'
    c.build_settings['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks']
    c.build_settings.delete('IPHONEOS_DEPLOYMENT_TARGET')
  end
end
watch_group = group_for(project, 'TripticWatch')
add_files(watch_group, watch, %w[TripticWatchApp.swift ContentView.swift WatchModel.swift WatchConnectivityReceiver.swift])
attach(watch, shared_refs)
%w[Info.plist].each { |n| watch_group.files.find { |f| f.path == n } || watch_group.new_file(n) }
assets = watch_group.files.find { |f| f.path == 'Assets.xcassets' } || watch_group.new_file('Assets.xcassets')
resources = watch.resources_build_phase
resources.add_file_reference(assets) unless resources.files_references.include?(assets)
watch_privacy = watch_group.files.find { |f| f.path == 'PrivacyInfo.xcprivacy' } || watch_group.new_file('PrivacyInfo.xcprivacy')
resources.add_file_reference(watch_privacy) unless resources.files_references.include?(watch_privacy)

# 워치 앱 Info.plist 현지화(위치 권한 문구) — 앱과 같은 방식의 InfoPlist.strings 변형 그룹
unless watch_group.children.any? { |c| c.display_name == 'InfoPlist.strings' }
  variant = project.new(Xcodeproj::Project::Object::PBXVariantGroup)
  variant.name = 'InfoPlist.strings'
  variant.source_tree = '<group>'
  watch_group << variant
  { 'en' => 'en', 'ko' => 'ko', 'ja' => 'ja', 'zh-Hant' => 'zh-Hant' }.each do |lang, dir|
    ref = project.new(Xcodeproj::Project::Object::PBXFileReference)
    ref.name = lang
    ref.path = "#{dir}.lproj/InfoPlist.strings"
    ref.source_tree = '<group>'
    ref.last_known_file_type = 'text.plist.strings'
    variant << ref
  end
  watch.resources_build_phase.add_file_reference(variant)
end
project.root_object.known_regions = (project.root_object.known_regions + %w[en ko ja zh-Hant]).uniq

# ── App에 끼워 넣기: 위젯은 PlugIns, 워치 앱은 Watch 폴더 ──
[widget, watch].each do |t|
  app.add_dependency(t) unless app.dependencies.any? { |d| d.target == t }
end

def embed_phase(app, name, spec, dst_path)
  phase = app.copy_files_build_phases.find { |p| p.name == name }
  return phase if phase
  phase = app.new_copy_files_build_phase(name)
  phase.dst_subfolder_spec = spec
  phase.dst_path = dst_path
  phase
end

ext_phase = embed_phase(app, 'Embed Foundation Extensions', '13', '')
unless ext_phase.files.any? { |f| f.file_ref == widget.product_reference }
  bf = ext_phase.add_file_reference(widget.product_reference, true)
  bf.settings = { 'ATTRIBUTES' => %w[RemoveHeadersOnCopy] }
end
watch_phase = embed_phase(app, 'Embed Watch Content', '16', '$(CONTENTS_FOLDER_PATH)/Watch')
unless watch_phase.files.any? { |f| f.file_ref == watch.product_reference }
  bf = watch_phase.add_file_reference(watch.product_reference, true)
  bf.settings = { 'ATTRIBUTES' => %w[RemoveHeadersOnCopy] }
end

project.save
puts '완료: 위젯·워치 대상을 추가했다 (이미 있으면 그대로)'
