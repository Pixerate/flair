// flair-metal-hash: 066b789f
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
}

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
    int uCount;
    float uFrame;
    float uAspect;
    float uHold;
    float uPunch;
    float uAngle;
    char _m19_pad[8];
    packed_float3 uFilm;
    float uShadow;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_filmstrip_montage_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float ease(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return (t * t) * (3.0 - (2.0 * t));
}

static inline __attribute__((always_inline))
float2x2 rot2(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float tileBox(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
int2 itemSize(thread const int& i, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        return int2(uItem0.get_width(), uItem0.get_height());
    }
    if (i == 1)
    {
        return int2(uItem1.get_width(), uItem1.get_height());
    }
    if (i == 2)
    {
        return int2(uItem2.get_width(), uItem2.get_height());
    }
    if (i == 3)
    {
        return int2(uItem3.get_width(), uItem3.get_height());
    }
    if (i == 4)
    {
        return int2(uItem4.get_width(), uItem4.get_height());
    }
    return int2(uItem5.get_width(), uItem5.get_height());
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _94)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_94.uBackdrop) * _94.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_94.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _94)
{
    float4 _237;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _237 = overBackdrop(param, _94);
    }
    else
    {
        float2 param_1 = fract(uv);
        _237 = float4(testCard(param_1), 1.0);
    }
    return _237;
}

static inline __attribute__((always_inline))
float4 itemAt(thread const int& i, thread const float2& uv, constant FlairUniforms& _94, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        float2 param = uv;
        return pictureRGBA(uItem0, uItem0Smplr, param, _94);
    }
    if (i == 1)
    {
        float2 param_1 = uv;
        return pictureRGBA(uItem1, uItem1Smplr, param_1, _94);
    }
    if (i == 2)
    {
        float2 param_2 = uv;
        return pictureRGBA(uItem2, uItem2Smplr, param_2, _94);
    }
    if (i == 3)
    {
        float2 param_3 = uv;
        return pictureRGBA(uItem3, uItem3Smplr, param_3, _94);
    }
    if (i == 4)
    {
        float2 param_4 = uv;
        return pictureRGBA(uItem4, uItem4Smplr, param_4, _94);
    }
    float2 param_5 = uv;
    return pictureRGBA(uItem5, uItem5Smplr, param_5, _94);
}

static inline __attribute__((always_inline))
float4 itemCover(thread const int& i, thread float2& uv, thread const float& aspect, constant FlairUniforms& _94, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    int param = i;
    int2 ts = itemSize(param, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    bool _490 = ts.x > 1;
    bool _496;
    if (_490)
    {
        _496 = ts.y > 1;
    }
    else
    {
        _496 = _490;
    }
    if (_496)
    {
        float ta = float(ts.x) / float(ts.y);
        if (ta > aspect)
        {
            uv.x = (((uv.x - 0.5) * aspect) / ta) + 0.5;
        }
        else
        {
            uv.y = (((uv.y - 0.5) * ta) / aspect) + 0.5;
        }
    }
    int param_1 = i;
    float2 param_2 = uv;
    return itemAt(param_1, param_2, _94, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _94)
{
    float4 base = float4(float3(_94.uBackground) * _94.uBackgroundAlpha, _94.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _94, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float2 p = (fragCoord - (float2(_94.iResolution[0], _94.iResolution[1]) * 0.5)) / float2(_94.iResolution[1u]);
    float px = 1.0 / _94.iResolution[1u];
    int n = clamp(_94.uCount, 1, 6);
    float fh = _94.uFrame;
    float fw = fh * _94.uAspect;
    float pitch = fw + (fh * 0.100000001490116119384765625);
    float sh = fh * 1.37999999523162841796875;
    float c = _94.iTime / fast::max(_94.uHold, 0.100000001490116119384765625);
    float k = floor(c);
    float f = c - k;
    float param = f / 0.3499999940395355224609375;
    float _600 = ease(param);
    float step_ = _600;
    float param_1 = (f - 0.4000000059604644775390625) / 0.1500000059604644775390625;
    float _607 = ease(param_1);
    float param_2 = (1.0 - f) / 0.1500000059604644775390625;
    float _612 = ease(param_2);
    float punch = _607 * _612;
    float offset = (k + step_) * pitch;
    float angle = radians(_94.uAngle);
    float param_3 = -angle;
    float2 r = rot2(param_3) * p;
    float4 acc = float4(0.0);
    float strip = smoothstep(px, -px, abs(r.y) - (0.5 * sh));
    float4 param_4 = acc;
    float3 param_5 = float3(0.0);
    float param_6 = ((_94.uShadow * 0.5) * exp(-powr(fast::max(abs(r.y + 0.01200000010430812835693359375) - (0.5 * sh), 0.0) / 0.0199999995529651641845703125, 2.0))) * (1.0 - strip);
    acc = over(param_4, param_5, param_6);
    if (strip > 0.0)
    {
        float x = r.x + offset;
        float cell = floor((x / pitch) + 0.5);
        float lx = x - (cell * pitch);
        float2 param_7 = float2(mod(x, pitch * 0.25) - (pitch * 0.125), (abs(r.y) - (0.5 * fh)) - (0.25 * (sh - fh)));
        float2 param_8 = float2(pitch * 0.054999999701976776123046875, fh * 0.04500000178813934326171875);
        float param_9 = fh * 0.014999999664723873138427734375;
        float hole = tileBox(param_7, param_8, param_9);
        float film = strip * smoothstep(-px, px, hole);
        float4 param_10 = acc;
        float3 param_11 = float3(_94.uFilm);
        float param_12 = film;
        acc = over(param_10, param_11, param_12);
        float2 param_13 = float2(lx, r.y);
        float2 param_14 = float2(0.5 * fw, 0.5 * fh);
        float param_15 = fh * 0.0199999995529651641845703125;
        float win = smoothstep(px, -px, tileBox(param_13, param_14, param_15));
        if (win > 0.0)
        {
            int item = int(mod(cell, float(n)));
            int param_16 = item;
            float2 param_17 = (float2(lx, r.y) / float2(fw, fh)) + float2(0.5);
            float param_18 = _94.uAspect;
            float4 _794 = itemCover(param_16, param_17, param_18, _94, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
            float4 pic = _794;
            float out_ = (cell == (k + 1.0)) ? punch : 0.0;
            float4 param_19 = acc;
            float3 param_20 = pic.xyz * (1.0 - (0.699999988079071044921875 * out_));
            float param_21 = win * pic.w;
            acc = over(param_19, param_20, param_21);
        }
    }
    if (punch > 0.0)
    {
        int item_1 = int(mod(k + 1.0, float(n)));
        float scale = mix(1.0, _94.uPunch, punch);
        float param_22 = (-angle) * (1.0 - punch);
        float2 q = (rot2(param_22) * p) / float2(scale);
        float2 half_ = float2(0.5 * fw, 0.5 * fh);
        float qpx = px / scale;
        float2 param_23 = q - float2(0.0, -0.014999999664723873138427734375);
        float2 param_24 = half_;
        float param_25 = 0.00999999977648258209228515625;
        float4 param_26 = acc;
        float3 param_27 = float3(0.0);
        float param_28 = ((_94.uShadow * punch) * 0.5) * exp(-powr(fast::max(tileBox(param_23, param_24, param_25), 0.0) / 0.02999999932944774627685546875, 2.0));
        acc = over(param_26, param_27, param_28);
        float2 param_29 = q;
        float2 param_30 = half_ + float2(fh * 0.02999999932944774627685546875);
        float param_31 = fh * 0.02999999932944774627685546875;
        float edge = smoothstep(qpx, -qpx, tileBox(param_29, param_30, param_31));
        float4 param_32 = acc;
        float3 param_33 = float3(_94.uFilm);
        float param_34 = edge * punch;
        acc = over(param_32, param_33, param_34);
        float2 param_35 = q;
        float2 param_36 = half_;
        float param_37 = fh * 0.0199999995529651641845703125;
        float win_1 = smoothstep(qpx, -qpx, tileBox(param_35, param_36, param_37));
        int param_38 = item_1;
        float2 param_39 = (q / (half_ * 2.0)) + float2(0.5);
        float param_40 = _94.uAspect;
        float4 _937 = itemCover(param_38, param_39, param_40, _94, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
        float4 pic_1 = _937;
        float4 param_41 = acc;
        float3 param_42 = pic_1.xyz;
        float param_43 = (win_1 * pic_1.w) * punch;
        acc = over(param_41, param_42, param_43);
    }
    float4 param_44 = acc;
    fragColor = finish(param_44, _94);
}

fragment flair_filmstrip_montage_frag_out flair_filmstrip_montage_frag(constant FlairUniforms& _94 [[buffer(0)]], texture2d<float> uItem0 [[texture(1)]], texture2d<float> uItem1 [[texture(2)]], texture2d<float> uItem2 [[texture(3)]], texture2d<float> uItem3 [[texture(4)]], texture2d<float> uItem4 [[texture(5)]], texture2d<float> uItem5 [[texture(6)]], sampler uItem0Smplr [[sampler(1)]], sampler uItem1Smplr [[sampler(2)]], sampler uItem2Smplr [[sampler(3)]], sampler uItem3Smplr [[sampler(4)]], sampler uItem4Smplr [[sampler(5)]], sampler uItem5Smplr [[sampler(6)]], float4 gl_FragCoord [[position]])
{
    flair_filmstrip_montage_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _966;
    if (_94.flair_flipY > 0.5)
    {
        _966 = _94.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _966 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _966);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _94, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

