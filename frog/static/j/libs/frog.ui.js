/*
Copyright (c) 2012 Brett Dixon

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in 
the Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the 
Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS 
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR 
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER 
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION 
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


Frog.UI = (function(Frog) {
    var self = this;
    var ID, Store, ToolBar, SwitchArtistWindow;
    var navmenu = Ext.create('Ext.menu.Menu', {hideMode: 'display'});
    
    var uploadEnabled = false;
    var advancedFilter = Frog.Prefs.advanced_filter;

    self.renderCallback = null;


    // -- Models
    Ext.define('Gallery', {
        extend: 'Ext.data.Model',
        fields: [
            {name: 'id'},
            {name: 'title'},
            {name: 'image_count', type: 'int'},
            {name: 'video_count', type: 'int'},
            {name: 'owner'},
            {name: 'description'}
        ]
    });
    Ext.define('Artist', {
        extend: 'Ext.data.Model',
        fields: ['id', 'name', 'username', 'email']
    });
    Store = Ext.create('Ext.data.TreeStore', {
        autoLoad: true,
        autoSync: true,
        model: 'Gallery',
        proxy: {
            type: 'ajax',
            url: '/frog/gallery',
            reader: {
                type: 'json',
                root: 'values'
            }
        }
    });
    Ext.create('Ext.data.Store', {
        autoLoad: true,
        autoSync: true,
        model: 'Gallery',
        storeId: 'galleries',
        proxy: {
            type: 'ajax',
            url: '/frog/gallery?flat=1',
            reader: {
                type: 'json',
                root: 'values'
            }
        }
    });
    Ext.create('Ext.data.Store', {
        storeId: 'security',
        fields: ['name', 'value'],
        data: [
            {name: 'Public', value: 0},
            {name: 'Private', value: 1},
            {name: 'Personal', value: 2}
        ]
    });
    Ext.create('Ext.data.Store', {
        model: 'Artist',
        storeId: 'artists',
        proxy: {
            type: 'ajax',
            url: '/frog/artistlookup',
            reader: {
                type: 'json',
                root: 'values'
            }
        },
        autoLoad: true
    });

    ToolBar = Ext.create('Ext.toolbar.Toolbar');
    RemoveObserver = new Frog.Observer();
    ChangeObserver = new Frog.Observer();
    FilterObserver = new Frog.Observer();

    function setId(id) {
        ID = id;
    }

    function enableUploads() {
        uploadEnabled = true;
    }

    function render(el) {
        ToolBar.render(el);
        // -- Navigation panel
        navmenu.add(buildNav());
        ToolBar.add({
            text: 'Navigation',
            icon: Frog.icon('compass'),
            menu: navmenu
        });
        // -- Check for user
        new Request.JSON({
            url: '/frog/getuser',
            onSuccess: function(res) {
                if (res.isError) {
                    addLoginAction();
                }
                else{
                    if (uploadEnabled) {
                        // -- Upload button
                        ToolBar.add({
                            id: 'frogBrowseButton',
                            text: 'Upload',
                            icon: Frog.icon('add')
                        });
                    }
                    // -- Edit Tags button
                    ToolBar.add({
                        text: 'Edit Tags',
                        icon: Frog.icon('tag_orange'),
                        handler: editTagsHandler
                    });
                    var menuconfig = {
                        hideMode: 'display',
                        items: [
                            {
                                text: 'Remove Selected',
                                icon: Frog.icon('cross'),
                                handler: removeHandler
                            },
                            {
                                text: 'Copy to Gallery',
                                icon: Frog.icon('page_white_copy'),
                                handler: copyHandler
                            },
                            {
                                text: 'Download Sources',
                                icon: Frog.icon('compress'),
                                handler: downloadHandler
                            },
                            '-',
                            {
                                text: 'Switch Artist',
                                icon: Frog.icon('user_edit'),
                                handler: switchArtistHandler
                            }
                        ]
                    };
                    if (res.value.gallery) {
                        if (res.value.gallery.parent === null) {
                            menuconfig.items.push({
                                text: 'Add Sub Gallery',
                                icon: Frog.icon('application_view_tile'),
                                handler: addSubGalleryHandler
                            });
                        }
                    }
                    if (res.value.gallery !== null) {
                        menuconfig.items.push('-');
                        menuconfig.items.push(
                            {
                                text: 'Security',
                                icon: Frog.icon('lock'),
                                menu: {
                                    items: [
                                        {
                                            text: 'Public',
                                            group: 'security',
                                            checked: res.value.gallery.security === 0,
                                            handler: securityHandler
                                        },
                                        {
                                            text: 'Private',
                                            group: 'security',
                                            checked: res.value.gallery.security === 1,
                                            handler: securityHandler
                                        },
                                        {
                                            text: 'Personal',
                                            group: 'security',
                                            checked: res.value.gallery.security === 2,
                                            handler: securityHandler
                                        }
                                    ]
                                }
                            }
                        );
                    }
                    var managemenu =  Ext.create('Ext.menu.Menu', menuconfig);
                    
                    ToolBar.add({
                        text: 'Manage',
                        icon: Frog.icon('photos'),
                        menu: managemenu
                    });
                    ToolBar.add({
                        text: 'Filter',
                        icon: Frog.icon('filter'),
                        enableToggle: true,
                        pressed: advancedFilter,
                        toggleHandler: function(btn) {
                            advancedFilter = btn.pressed;
                            Frog.Prefs.set('advanced_filter', advancedFilter);
                            FilterObserver.fire(advancedFilter);
                            if (advancedFilter) {
                                msg('You are now using the Advanced Filter', 'alert-info');
                            }
                            else {
                                msg('You are now using the Standard Filter', 'alert-success');
                            }
                        }
                    });
                    ToolBar.add('-');
                    
                    // -- Help button
                    ToolBar.add({
                        icon: Frog.icon('help'),
                        handler: helpHandler
                    });
                    // -- Preferences Menu
                    ToolBar.add({
                        icon: Frog.icon('cog'),
                        menu: buildPrefMenu()
                    });                    
                }
        
                if (self.renderCallback !== null) {
                    renderCallback();
                }
            }
        }).GET({gallery: ID});
    }
    function addEvent(event, fn) {
        switch(event) {
            case 'remove':
                RemoveObserver.subscribe(fn);
                break;
            case 'change':
                ChangeObserver.subscribe(fn);
                break;
            case 'filter':
                FilterObserver.subscribe(fn);
                break;
            case 'render':
                self.renderCallback = fn;
                break;
        }
    }
    function addTool(label, icon, callback) {
        ToolBar.add('-');
        ToolBar.add({
            text: label,
            icon: icon,
            handler: callback
        });
    }


    // Private
    function buildNav() {
        Store.load();
        var grid = Ext.create('Ext.tree.Panel', {
            width: 600,
            height: 300,
            frame: true,
            title: 'Galleries',
            hideMode: 'display',
            store: Store,
            rootVisible: false,
            useArrows: true,
            singleExpand: true,
            columns: [{
                xtype: 'treecolumn',
                text: 'Title',
                flex: 2,
                sortable: true,
                dataIndex: 'title'
            }, {
                text: 'Images',
                flex: 1,
                sortable: true,
                dataIndex: 'image_count',
                field: {
                    xtype: 'textfield'
                }
            }, {
                text: 'Videos',
                flex: 1,
                sortable: true,
                dataIndex: 'video_count',
                field: {
                    xtype: 'textfield'
                }
            }, {
                text: 'Description',
                flex: 2,
                dataIndex: 'description'
            }]
        });
        grid.on('itemClick', function(view, rec, item) {
            location.href = '/frog/gallery/' + rec.data.id;
        });

        return grid;
    }
    function buildPrefMenu() {
        var colorMenu = Ext.create('Ext.menu.ColorPicker', {
            height: 24,
            handler: function(cm, color){
                Frog.Prefs.set('backgroundColor', JSON.stringify('#' + color));
            }
        });
        colorMenu.picker.colors = ['000000', '424242', '999999', 'FFFFFF'];
        var tileSizeHandler = function(item, checked) {
            if (!checked) {
                Frog.Prefs.set('tileCount', size);
                return;
            }
            var size = item.value;
            Frog.Prefs.set('tileCount', size, ChangeObserver.fire.bind(ChangeObserver));
            item.parentMenu.hide();
        }
        var batchSize = Ext.create('Ext.form.field.Number', {
            value: Frog.Prefs.batchSize,
            minValue: 0,
            maxValue: 500
        });
        batchSize.on('change', function(field, val) { 
            Frog.Prefs.set('batchSize', val);
        });

        var menu = Ext.create('Ext.menu.Menu', {
            hideMode: 'display',
            items: [
                {
                    text: 'Viewer Background',
                    menu: colorMenu
                },
                {
                    text: 'Thumbnail Size',
                    menu: [
                        {
                            text: 'Large (6)',
                            value: 6,
                            checked: Frog.Prefs.tileCount === 6,
                            group: 'theme',
                            checkHandler: tileSizeHandler
                        }, {
                            text: 'Medium (9)',
                            value: 9,
                            checked: Frog.Prefs.tileCount === 9,
                            group: 'theme',
                            checkHandler: tileSizeHandler
                        }, {
                            text: 'Small (12)',
                            value: 12,
                            checked: Frog.Prefs.tileCount === 12,
                            group: 'theme',
                            checkHandler: tileSizeHandler
                        }
                    ]
                },
                {
                    text: 'Item Request Size',
                    menu: [
                        batchSize
                    ]
                }, {
                    xtype: 'menucheckitem',
                    text: 'Include Images',
                    checked: Frog.Prefs.include_image,
                    checkHandler: function(item, checked) {
                        Frog.Prefs.set('include_image', checked);
                        item.parentMenu.hide();
                        ChangeObserver.fire(Frog.Prefs);;
                    }
                }, {
                    xtype: 'menucheckitem',
                    text: 'Include Video',
                    checked: Frog.Prefs.include_video,
                    checkHandler: function(item, checked) {
                        Frog.Prefs.set('include_video', checked);
                        item.parentMenu.hide();
                        ChangeObserver.fire(Frog.Prefs);;
                    }
                }
            ]
        });

        return menu;
    }
    function editTagsHandler() {
        var guids = [];
        $$('.selected').each(function(item) {
            var guid = Frog.util.getData(item, 'frog_guid');
            guids.push(guid);
        });
        var win = Ext.create('widget.window', {
            title: 'Edit Tags',
            icon: Frog.icon('tag_orange'),
            closable: true,
            resizable: false,
            modal: true,
            width: 800,
            height: 600,
            layout: 'fit',
            bodyStyle: 'padding: 5px;',
            items: [{
                loader: {
                    url: '/frog/tag/manage?guids=' + guids.join(','),
                    contentType: 'html',
                    loadMask: true,
                    autoLoad: true,
                    scripts: true,
                    cache: false
                }
            }],
            buttons: [{
                text: 'Save',
                handler: function() {
                    var add = [], rem = [];
                    $$('#frog_add li').each(function(item) {
                        var id = Frog.util.getData(item, 'frog_tag_id');
                        add.push(id);
                    });
                    $$('#frog_rem li').each(function(item) {
                        var id = Frog.util.getData(item, 'frog_tag_id');
                        rem.push(id);
                    });
                    
                    new Request.JSON({
                        url: '/frog/tag/manage',
                        headers: {"X-CSRFToken": Cookie.read('csrftoken')},
                        onSuccess: function() {}
                    }).POST({
                        add: add.join(','),
                        rem: rem.join(','),
                        guids: guids.join(',')
                    });
                    win.close();
                }
            },{
                text: 'Cancel',
                handler: function() {
                    win.close();
                }
            }]
        });
        win.show();
    }
    function editMetaHandler() {
        if ($$('.selected').length === 0) {
            return;
        }
        var guid = Frog.util.getData($$('.selected')[0], 'frog_guid');
        Ext.define('Meta', {
            extend: 'Ext.data.Model',
            fields: [
                {name: 'title', type: 'string'},
                {name: 'description', type: 'string'},
                {name: 'thumbnail', type: 'string'}
            ]
        });
        var store = Ext.create('Ext.data.Store', {
            model: 'Meta',
            proxy: {
                type: 'ajax',
                url: '/frog/piece/' + guid,
                reader: {
                    type: 'json',
                    root: 'value'
                }
            }
        });

        var form = Ext.create('Ext.form.Panel', {
            items: [{
                xtype:'fieldset',
                items: [{
                    xtype: 'textfield',
                    name: 'title',
                    fieldLabel: 'Title',
                    store: store,
                    valueField: 'title'
                }, {
                    xtype: 'textarea',
                    name: 'description',
                    fieldLabel: 'Description',
                    store: store,
                    valueField: 'decription'
                }
                ]
            }],
        });


        var win = Ext.create('widget.window', {
            title: 'Edit Meta',
            icon: Frog.icon('pencil'),
            closable: true,
            resizable: false,
            modal: true,
            width: 400,
            // height: 300,
            layout: 'fit',
            bodyStyle: 'padding: 5px;',
            items: [{
                xtype: 'grid',
                store: store,
                columns: [
                    {
                        text     : 'File',
                        flex     : 6,
                        sortable : false,
                        dataIndex: 'file'
                    },
                    {
                        text     : 'Size',
                        flex     : 1,
                        sortable : false,
                        dataIndex: 'size'
                    },
                    {
                        text: 'Created',
                        flex: 2,
                        sortable: false,
                        dataIndex: 'date',
                        xtype: 'datecolumn',
                        format:'Y-m-d'
                    },
                    {
                        text     : '%',
                        flex     : 1,
                        sortable : false,
                        dataIndex: 'percent'
                    },
                    {
                        text: 'Status',
                        flex: 2,
                        sortable: false,
                        dataIndex: 'status'
                    },
                    {
                        xtype: 'actioncolumn',
                        flex: 1,
                        sortable: false,
                        items: [
                            {
                                text: 'remove',
                                icon: '/static/frog/i/delete.png',
                                handler: function(grid, rowIndex, colIndex) {
                                    var rec = store.getAt(rowIndex);
                                    var file = self.uploader.getFile(rec.get('id'));
                                    self.uploader.removeFile(file);
                                    store.remove([rec]);
                                }
                            }
                        ]
                    }
                ],
                flex: 1,
                viewConfig: {
                    stripeRows: true,
                    getRowClass: function(record) {
                        var c = record.get('unique');
                        return (c) ? '' : 'red';
                    }
                }
            }],
            buttons: [{
                text: 'Save',
                handler: function() {
                    var data = form.getValues(false, true)
                    new Request.JSON({
                        url: '/frog/piece/' + guid + '/',
                        emulation: false,
                        onSuccess: function(res) {
                            $$('.selected')[0].getElements('.tag-hover > span')[0].set('text', data.title);
                            var obj = Frog.GalleryObject.getObjectFromGuid(guid);
                            obj.title = data.title;
                            obj.description = data.description;
                        }
                    }).PUT(data);
                    win.close();
                    Frog.GalleryObject.keyboard.activate();
                }
            },{
                text: 'Cancel',
                handler: function() {
                    win.close();
                    Frog.GalleryObject.keyboard.activate();
                }
            }]
        });
        win.add(form);
        win.show();
        Frog.GalleryObject.keyboard.relinquish();
        store.on('load', function(store, records, successful, eOpts) {
            form.loadRecord(records[0]);
        });
        store.load();
    }
    function removeHandler(silent) {
        if (typeof(silent) === 'undefined') {
            silent = false;
        }
        else if (typeof(silent) !== 'boolean') {
            silent = false;
        }
        
        var ids = [];
        $$('.selected').each(function(item) {
            ids.push(Frog.util.getData(item, 'frog_tn_id').toInt());
        });
        RemoveObserver.fire({ids: ids, silent: silent});
    }
    function copyHandler() {
        var win = Ext.create('widget.window', {
            title: 'Copy to Gallery',
            icon: Frog.icon('page_white_copy'),
            closable: true,
            resizable: false,
            modal: true,
            width: 600,
            height: 330,
            bodyStyle: 'padding: 5px;'
        });
        win.show();

        var fp = Ext.create('Ext.FormPanel', {
            items: [{
                xtype: 'label',
                text: "Copy images to a new Gallery:"
            }, {
                xtype:'fieldset',
                title: 'New Gallery',
                items: [
                    {
                        fieldLabel: 'Title',
                        xtype: 'textfield',
                        name: 'title'

                    }, {
                        fieldLabel: 'Description',
                        xtype: 'textfield',
                        name: 'description'
                    }, {
                        fieldLabel: 'Security Level',
                        xtype: 'combobox',
                        name: 'security',
                        editable: false,
                        store: 'security',
                        displayField: 'name',
                        valueField: 'value',
                        value: 0
                    }
                ]
            }, {
                xtype: 'label',
                text: 'Or choose an existing one:'
            }, {
                xtype:'fieldset',
                title: 'Existing Gallery',
                items: [
                    {
                        xtype: 'combobox',
                        editable: false,
                        store: 'galleries',
                        displayField: 'title',
                        valueField: 'id',
                        id: 'frog_gallery_id'
                    }
                ]
            }, {
                xtype: 'checkbox',
                fieldLabel: 'Move Items?',
                name: 'move'
            }],
            buttons: [{
                text: 'Submit',
                handler: function() {
                    var data = fp.getForm().getValues();
                    var selected = $$('.thumbnail.selected');
                    var obj = {};

                    data.id = data['frog_gallery_id-inputEl'];
                    if (typeof(data.id) === 'undefined' && data.title === '') {
                        Ext.MessageBox.show({
                            title: 'Missing Information',
                            msg: 'Please enter a title or choose an existing gallery',
                            buttons: Ext.MessageBox.OK,
                            icon: Ext.MessageBoxINFO
                        });
                        
                        return false;
                    }

                    // -- New Gallery
                    if (data.title !== '') {
                        // -- Create the new gallery first synchronously
                        new Request.JSON({
                            url: '/frog/gallery',
                            async: false,
                            headers: {"X-CSRFToken": Cookie.read('csrftoken')},
                            onSuccess: function(res) {
                                data.id = res.value.id;
                            }
                        }).POST({title: data.title, description: data.description, security: data.security});
                    }

                    guids = [];
                    selected.each(function(item) {
                        guids.push(Frog.util.getData(item, 'frog_guid'));
                    });
                    obj.guids = guids.join(',');

                    if (data.move === 'on' && data.id !== ID) {
                        obj.move = ID;
                    }

                    new Request.JSON({
                        url: '/frog/gallery/' + data.id,
                        emulation: false,
                        headers: {"X-CSRFToken": Cookie.read('csrftoken')},
                        onSuccess: function(res) {
                            Store.load();
                            Ext.MessageBox.confirm('Confirm', 'Would you like to visit this gallery now?', function(res) {
                                if (res === 'yes') {
                                    window.location = '/frog/gallery/' + data.id;
                                }
                            });
                        }
                    }).PUT(obj);
                    win.close();

                    if (typeof(obj.move) !== 'undefined') {
                        removeHandler(true);
                    }
                }
            },{
                text: 'Cancel',
                handler: function() {
                    win.close();
                }
            }]
        });
        win.add(fp);
    }
    function downloadHandler() {
        var selected = $$('.thumbnail.selected');
        guids = [];
        selected.each(function(item) {
            guids.push(Frog.util.getData(item, 'frog_guid'));
        });
        location.href = '/frog/download?guids=' + guids.join(',');
    }
    function switchArtistHandler() {
        var win = Frog.UI.SwitchArtist();
        win.show();
    }
    function addSubGalleryHandler() {
        Ext.MessageBox.prompt('Name', 'Please enter a title for the new gallery:', function(res, text) {
            if (res === 'ok') {
                new Request.JSON({
                    url: '/frog/gallery',
                    headers: {"X-CSRFToken": Cookie.read('csrftoken')},
                    onSuccess: function(res) {
                        Ext.MessageBox.alert('Gallery', res.message);
                        Store.load();
                    }
                }).POST({parent: ID, title: text});
            }
        });
    }
    function helpHandler() {
        var win = Ext.create('widget.window', {
            title: 'Ask for Help',
            icon: Frog.icon('help'),
            closable: true,
            closeAction: 'hide',
            resizable: false,
            modal: true,
            width: 600,
            height: 400,
            bodyPadding: 10,
            bodyStyle: 'padding: 5px; background: transparent;'
        });
        win.show();
        win.add({
            xtype: 'label',
            text: "Have a question, problem or suggestion?",
            style: {
                'font-size': '14px',
                'font-weight': 'bold'
            }
        })
        var fp = Ext.create('Ext.FormPanel', {
            items: [
            {
                xtype: 'textareafield',
                name: 'message',
                anchor: '100%',
                height: 300
            }],
            buttons: [{
                text: 'Send',
                handler: function() {
                    var data = fp.getForm().getValues();
                    new Request({
                        url: '/frog/help/',
                        headers: {"X-CSRFToken": Cookie.read('csrftoken')}
                    }).POST(data);
                    win.close();
                }
            },{
                text: 'Cancel',
                handler: function() {
                    win.close();
                }
            }]
        });
        win.add(fp)
    }
    function securityHandler(item, event) {
        var store = Ext.getStore('security');
        new Request.JSON({
            url: '/frog/gallery/' + ID,
            emulation: false,
            headers: {"X-CSRFToken": Cookie.read('csrftoken')}
        }).PUT({security: store.findRecord('name', item.text).data.value});
    }
    function addPrivateMenu() {
        var id = this.id;
        var makepublic = managemenu.add({
            text: 'Make public',
            icon: Frog.icon('world'),
            handler: function() {
                Ext.MessageBox.confirm('Confirm', 'Are you sure you want to make this public?', function(res) {
                    if (res === 'yes') {
                        new Request.JSON({
                            url: '/frog/gallery/' + ID,
                            emulation: false,
                            headers: {"X-CSRFToken": Cookie.read('csrftoken')}
                        }).PUT({security: 0});
                        managemenu.remove(makepublic);
                        managemenu.remove(makeprotected);
                    }
                });
            }
        });
        var makeprotected = managemenu.add({
            text: 'Make protected',
            icon: Frog.icon('world'),
            handler: function() {
                Ext.MessageBox.confirm('Confirm', 'Are you sure you want to make this protected?', function(res) {
                    if (res === 'yes') {
                        new Request.JSON({
                            url: '/frog/gallery/' + ID,
                            emulation: false,
                            headers: {"X-CSRFToken": Cookie.read('csrftoken')}
                        }).PUT({security: 1});
                        managemenu.remove(makepublic);
                    }
                });
            }
        });
    }

    function addLoginAction() {
        ToolBar.add('-');
        ToolBar.add({
            text: 'Login',
            icon: Frog.icon('user'),
            handler: function() {
                location.href = '/frog';
            }
        });
    }

    function createBox(text, cls){
       return '<div class="msg ' + cls + '"><p>' + text + '</p></div>';
    }
    var msgCt;
    function msg(text, cls){
        if (!msgCt) {
            msgCt = Ext.core.DomHelper.insertFirst(document.body, {id:'msg-div'}, true);
        }
        var s = Ext.String.format.apply(String, Array.prototype.slice.call(arguments, 1));
        var m = Ext.core.DomHelper.append(msgCt, createBox(text, cls), true);
        m.hide();
        m.slideIn('t').ghost("t", { delay: 1000, remove: true});
    }

    // -- API
    var api = {
        render: render,
        setId: setId,
        toolbar: ToolBar,
        addEvent: addEvent,
        addTool: addTool,
        enableUploads: enableUploads,
        isAdvancedFilterEnabled: function() { return advancedFilter; },
        editTags: editTagsHandler,
        alert: msg
    };

    return api;

})(window.Frog);


Frog.UI.SwitchArtist = function() {
    var win = Ext.create('widget.window', {
        title: 'Switch Artist',
        closable: true,
        closeAction: 'hide',
        resizable: false,
        modal: true,
        width: 400,
        height: 200,
        bodyStyle: 'padding: 5px;'
    });

    function switchArtistCallback(name) {
        var selected = $$('.thumbnail.selected');
        var guids = [];
        selected.each(function(item) {
            guids.push(Frog.util.getData(item, 'frog_guid'));
        });
        new Request.JSON({
            url: '/frog/switchartist',
            headers: {"X-CSRFToken": Cookie.read('csrftoken')},
            onSuccess: function(res) {
                if (res.isError) {
                    Frog.UI.alert('An error occurred, artist was not switched', 'alert-danger');
                }
                else {
                    Frog.UI.alert('Artist successfully switched', 'alert-success');
                    selected.each(function(el) {
                        var tag = el.getElement('span + div a.frog-tag');
                        tag.set('text', res.value.name.capitalize());
                        Frog.util.setData(tag, 'frog_tag_id', res.value.tag);
                    });
                }
            }
        }).POST({'artist': name.toLowerCase(), guids: guids.join(',')});
        selected.each(function(el) {
            var tag = el.getElement('span + div a.frog-tag');
            tag.set('text', name.capitalize());
            Frog.util.getData(tag, 'frog_tag_id', Frog.Tags.get(name.toLowerCase()));
        });
    }

    var fp = Ext.create('Ext.FormPanel', {
        items: [{
            xtype: 'label',
            text: "Start typing the name of an artist or if this is a new artist, type in the first and last name and click Send"
        }, {
            xtype: 'combobox',
            fieldLabel: 'Artist Name',
            store: 'artists',
            queryMode: 'remote',
            minChars: 3,
            displayField: 'name',
            name: 'artist_name'
        }],
        buttons: [{
            text: 'Send',
            handler: function() {
                var value = this.up('form').getForm().getFieldValues();
                switchArtistCallback(value.artist_name);
                win.close();
            }
        },{
            text: 'Cancel',
            handler: function() {
                win.close();
            }
        }]
    });
    win.add(fp);
    
    return win;
}
