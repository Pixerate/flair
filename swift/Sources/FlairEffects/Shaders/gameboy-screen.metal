// flair-metal-hash: fe30e36e
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uLines;
    float uPan;
    float uGhost;
    float uGrid;
    uint uDither;
    float3 uDark;
    float3 uLight;
    float3 uBezel;
    float3 uCase;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_gameboy_screen_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float roundBox(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _80)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_80.uBackdrop) * _80.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_80.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _80)
{
    float4 _224;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _224 = overBackdrop(param, _80);
    }
    else
    {
        float2 param_1 = fract(uv);
        _224 = float4(testCard(param_1), 1.0);
    }
    return _224;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _80)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _80).xyz;
}

static inline __attribute__((always_inline))
float bayer2(thread float2& a)
{
    a = floor(a);
    return fract((a.x / 2.0) + ((a.y * a.y) * 0.75));
}

static inline __attribute__((always_inline))
float bayer4(thread const float2& a)
{
    float2 param = a * 0.5;
    float _270 = bayer2(param);
    float2 param_1 = a;
    float _275 = bayer2(param_1);
    return (_270 * 0.25) + _275;
}

static inline __attribute__((always_inline))
float shade(thread const float2& uv, thread const float2& cell, constant FlairUniforms& _80, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    float l = dot(picture(uImage, uImageSmplr, param, _80), float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float _295;
    if (_80.uDither != 0u)
    {
        float2 param_1 = cell;
        _295 = (bayer4(param_1) - 0.4699999988079071044921875) * 0.699999988079071044921875;
    }
    else
    {
        _295 = 0.0;
    }
    float d = _295;
    return fast::clamp(floor(((l * 3.0) + 0.5) + d), 0.0, 3.0);
}

static inline __attribute__((always_inline))
float3 lcd(thread const float& s, constant FlairUniforms& _80)
{
    float _320;
    if (s < 0.5)
    {
        _320 = 0.0;
    }
    else
    {
        float _327;
        if (s < 1.5)
        {
            _327 = 0.2800000011920928955078125;
        }
        else
        {
            _327 = (s < 2.5) ? 0.87999999523162841796875 : 1.0;
        }
        _320 = _327;
    }
    float w = _320;
    return mix(_80.uDark, _80.uLight, float3(w));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _80, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 res = float2(_80.iResolution[0], _80.iResolution[1]);
    float lines = floor(_80.uLines);
    float cols = floor(((lines * 160.0) / 144.0) + 0.5);
    float px = fast::max(1.0, floor(fast::min((res.y * 0.63999998569488525390625) / lines, (res.x * 0.699999988079071044921875) / cols)));
    float2 size = float2(cols, lines) * px;
    float2 origin = floor((res - size) * 0.5);
    float2 q = fragCoord - origin;
    float margin = floor(size.y * 0.119999997317790985107421875);
    float3 col = _80.uCase;
    float2 bc = (q - (size * 0.5)) - float2(0.0, margin * 0.25);
    float2 bh = (size * 0.5) + float2(margin * 1.60000002384185791015625, margin * 1.25);
    bool _451 = bc.x > 0.0;
    bool _457;
    if (_451)
    {
        _457 = bc.y < 0.0;
    }
    else
    {
        _457 = _451;
    }
    float _458;
    if (_457)
    {
        _458 = margin * 2.0;
    }
    else
    {
        _458 = margin * 0.4000000059604644775390625;
    }
    float corner = _458;
    float2 param = bc;
    float2 param_1 = bh;
    float param_2 = corner;
    float bezel = roundBox(param, param_1, param_2);
    col = mix(col, _80.uBezel, float3(fast::clamp(0.5 - bezel, 0.0, 1.0)));
    float top = size.y + (margin * 0.60000002384185791015625);
    bool _494 = bezel < (-1.0);
    bool _501;
    if (_494)
    {
        _501 = q.y > top;
    }
    else
    {
        _501 = _494;
    }
    bool _513;
    if (_501)
    {
        _513 = q.y < (top + fast::max(1.0, floor(margin * 0.07999999821186065673828125)));
    }
    else
    {
        _513 = _501;
    }
    if (_513)
    {
        col = float3(0.550000011920928955078125, 0.1500000059604644775390625, 0.3499999940395355224609375);
    }
    bool _520 = bezel < (-1.0);
    bool _531;
    if (_520)
    {
        _531 = q.y > (top + (margin * 0.180000007152557373046875));
    }
    else
    {
        _531 = _520;
    }
    bool _546;
    if (_531)
    {
        _546 = q.y < ((top + (margin * 0.180000007152557373046875)) + fast::max(1.0, floor(margin * 0.07999999821186065673828125)));
    }
    else
    {
        _546 = _531;
    }
    if (_546)
    {
        col = float3(0.1500000059604644775390625, 0.180000007152557373046875, 0.4199999868869781494140625);
    }
    float2 led = float2((-margin) * 0.85000002384185791015625, size.y * 0.62000000476837158203125);
    float ledR = fast::max(2.0, margin * 0.180000007152557373046875);
    float glow = 0.85000002384185791015625 + (0.1500000059604644775390625 * sin(_80.iTime * 3.0));
    col = mix(col, float3(0.949999988079071044921875, 0.1500000059604644775390625, 0.119999997317790985107421875) * glow, float3(fast::clamp((ledR - length(q - led)) + 0.5, 0.0, 1.0)));
    bool _587 = q.x >= 0.0;
    bool _593;
    if (_587)
    {
        _593 = q.y >= 0.0;
    }
    else
    {
        _593 = _587;
    }
    bool _601;
    if (_593)
    {
        _601 = q.x < size.x;
    }
    else
    {
        _601 = _593;
    }
    bool _609;
    if (_601)
    {
        _609 = q.y < size.y;
    }
    else
    {
        _609 = _601;
    }
    if (_609)
    {
        float2 cell = floor(q / float2(px));
        float2 f = q - (cell * px);
        float2 uv = (cell + float2(0.5)) / float2(cols, lines);
        float2 now = uv + float2(_80.iTime * _80.uPan, 0.0);
        float2 before = now - float2(_80.uPan * 0.3499999940395355224609375, 0.0);
        float2 param_3 = now;
        float2 param_4 = cell;
        float s = shade(param_3, param_4, _80, uImage, uImageSmplr);
        float2 param_5 = before;
        float2 param_6 = cell;
        float g = shade(param_5, param_6, _80, uImage, uImageSmplr);
        float param_7 = s;
        float param_8 = g;
        float3 lit = mix(lcd(param_7, _80), lcd(param_8, _80), float3(_80.uGhost * 0.449999988079071044921875));
        float2 param_9 = now - float2(1.0 / cols, (-1.0) / lines);
        float2 param_10 = cell + float2(-1.0, 1.0);
        float behind = shade(param_9, param_10, _80, uImage, uImageSmplr);
        float param_11 = fast::min(s, behind);
        lit = mix(lit, lcd(param_11, _80), float3(_80.uGhost * 0.20000000298023223876953125));
        float _704;
        if (px >= 3.0)
        {
            bool _709 = f.x < 1.0;
            bool _718;
            if (!_709)
            {
                _718 = f.y >= (px - 1.0);
            }
            else
            {
                _718 = _709;
            }
            _704 = float(_718);
        }
        else
        {
            _704 = 0.0;
        }
        float edge = _704;
        col = mix(lit, mix(_80.uLight, float3(1.0), float3(0.07999999821186065673828125)), float3((edge * _80.uGrid) * 0.60000002384185791015625));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_gameboy_screen_frag_out flair_gameboy_screen_frag(constant FlairUniforms& _80 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_gameboy_screen_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _753;
    if (_80.flair_flipY > 0.5)
    {
        _753 = _80.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _753 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _753);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _80, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

